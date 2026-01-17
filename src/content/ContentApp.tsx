import React, { useState, useEffect, useRef, useCallback } from 'react';
import { normalizeKey, sortKeys } from '@/lib/utils';
import { Languages, Settings, Loader2, X, Terminal, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils'
import { PageCache } from '@/lib/pageCache';
import { TranslationRequest, TranslationResponse, UserSettings } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { logger } from '@/lib/logger';

const MAX_RETRIES = 3;
const MULTI_SEPARATOR = '\n\n%%\n\n';
const MULTI_SEPARATOR_REGEX = /\n\s*%%\s*\n/;

interface TranslationItem {
  id: string;
  element: HTMLElement;
  runId: number;
  originalTitle: string | null;
  parts: {
    node: Text;
    originalText: string;
    status: 'pending' | 'translating' | 'success' | 'error';
    translatedText?: string;
  }[];
  status: 'idle' | 'pending' | 'translating' | 'success' | 'error';
  retryCount: number;
  isVisible: boolean;
}

type TranslationPart = TranslationItem['parts'][number];

// Loading indicator using real DOM elements for better compatibility
let stylesInjected = false;

const injectStyles = () => {
  if (stylesInjected) return;
  stylesInjected = true;

  const styleId = 'ling-translate-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .ling-translate-indicator {
      display: inline !important;
      visibility: visible !important;
      opacity: 1 !important;
      margin-left: 4px !important;
      font-size: inherit !important;
      vertical-align: baseline !important;
      color: #10b981 !important;
      font-weight: bold !important;
      animation: ling-translate-pulse 1s infinite !important;
      pointer-events: none !important;
    }
    .ling-translate-spinner {
      display: inline-block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 12px !important;
      height: 12px !important;
      min-width: 12px !important;
      min-height: 12px !important;
      border: 2px solid rgba(16, 185, 129, 0.3) !important;
      border-top-color: #10b981 !important;
      border-radius: 50% !important;
      animation: ling-translate-spin 0.8s linear infinite !important;
      margin-left: 6px !important;
      vertical-align: middle !important;
      pointer-events: none !important;
      box-sizing: border-box !important;
    }
    @keyframes ling-translate-pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
    @keyframes ling-translate-spin {
      to { transform: rotate(360deg); }
    }
    .ling-translate-error {
      color: #ef4444 !important;
      border-bottom: 1px dotted #ef4444 !important;
    }
  `;
  document.head.appendChild(style);
};

// Helper to create loading indicator element
const createLoadingIndicator = (type: 'ellipsis' | 'spinner'): HTMLSpanElement => {
  const indicator = document.createElement('span');
  indicator.setAttribute('data-ling-indicator', 'true');
  if (type === 'ellipsis') {
    indicator.className = 'ling-translate-indicator';
    indicator.textContent = '...';
  } else {
    indicator.className = 'ling-translate-spinner';
  }
  return indicator;
};

// Helper to remove loading indicators from an element
const removeLoadingIndicators = (element: Element | null) => {
  if (!element) return;
  const indicators = element.querySelectorAll('[data-ling-indicator="true"]');
  indicators.forEach(ind => ind.remove());
};

const getAllTranslatableGroups = async () => {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!node.textContent?.trim()) return NodeFilter.FILTER_SKIP;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'code', 'pre', 'textarea', 'input', 'select', 'option', 'svg', 'path', 'img', 'video', 'audio', 'iframe'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip if editable
        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;

        // Skip if already translated
        if (parent.getAttribute('data-translated') === 'true') return NodeFilter.FILTER_REJECT;

        // Note: We do NOT check visibility here anymore, we collect everything and let IntersectionObserver handle priority
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const groups = new Map<HTMLElement, Text[]>();
  let lastYieldTime = Date.now();
  
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (parent) {
      const group = groups.get(parent);
      if (group) {
        group.push(node);
      } else {
        groups.set(parent, [node]);
      }
    }

    // Yield to main thread every 20ms to prevent UI freezing
    if (Date.now() - lastYieldTime > 20) {
      await new Promise(resolve => setTimeout(resolve, 0));
      lastYieldTime = Date.now();
    }
  }
  return groups;
};

// Promise-based limiter
const createRequestLimiter = (initialConcurrency: number, initialRequestsPerSecond: number) => {
  const concurrency = Math.max(1, initialConcurrency);
  const requestsPerSecond = Math.max(1, initialRequestsPerSecond);
  const intervalMs = 1000 / requestsPerSecond;
  let nextAvailableTime = 0;
  let activeCount = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  const schedule = () => {
    if (activeCount >= concurrency || queue.length === 0) return;

    const now = Date.now();
    const scheduledTime = Math.max(now, nextAvailableTime);
    const delay = scheduledTime - now;

    if (delay > 0) {
      if (timerId !== null) return;
      timerId = setTimeout(() => {
        timerId = null;
        schedule();
      }, delay);
      return;
    }

    const task = queue.shift();
    if (!task) return;

    nextAvailableTime = scheduledTime + intervalMs;
    activeCount += 1;

    task.fn()
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        activeCount = Math.max(0, activeCount - 1);
        schedule();
      });

    schedule();
  };

  const enqueue = async <T,>(fn: () => Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      schedule();
    });

  return enqueue;
};

const chunkParts = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const stripThoughtBlocks = (text: string): string => {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/<analysis>[\s\S]*$/gi, '')
    .trim();
};

const normalizeTranslationText = (original: string, translated: string): string => {
  const leading = original.match(/^\s+/)?.[0] ?? '';
  const trailing = original.match(/\s+$/)?.[0] ?? '';
  return `${leading}${translated.trim()}${trailing}`;
};

const splitMultiTranslation = (text: string): string[] => {
  const normalized = text.trim();
  if (!normalized) return [];
  return normalized.split(MULTI_SEPARATOR_REGEX).map(segment => segment.trim());
};

const ContentApp: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { settings, loadSettings, updateSettings } = useStore();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 2000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Translation State
  const translationItemsRef = useRef<Map<HTMLElement, TranslationItem>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const limiterRef = useRef<ReturnType<typeof createRequestLimiter> | null>(null);
  const translationRunIdRef = useRef(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const activeRequestsRef = useRef(0);

  const updateProcessingState = useCallback((delta: number) => {
    activeRequestsRef.current += delta;
    const isBusy = activeRequestsRef.current > 0;
    setIsProcessing(prev => {
        if (prev !== isBusy) return isBusy;
        return prev;
    });
  }, []);

  // Auto-translate State
  const autoTranslateTriggered = useRef(false);

  useEffect(() => {
      const init = async () => {
        await loadSettings();
        injectStyles();
        PageCache.init();
      };
      init();
    return () => {
      observerRef.current?.disconnect();
    };
  }, [loadSettings]);

  // Listen for storage changes to update settings in real-time
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.settings && changes.settings.newValue) {
        useStore.setState({ settings: changes.settings.newValue as UserSettings });
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    if (settings.developer) {
      logger.updateSettings(settings.developer);
    }
  }, [settings.developer]);

  const processTranslation = useCallback(async (item: TranslationItem) => {
    if (item.runId !== translationRunIdRef.current) return;
    if (item.status === 'translating' || item.status === 'success') return;

    const currentSettings = useStore.getState().settings;
    const limiter = limiterRef.current;
    
    if (!limiter) return;

    // Apply loading indicator using real DOM elements
    const applyLoadingState = (part: TranslationPart) => {
        const parent = part.node.parentElement;
        if (!parent) return;

        const style = currentSettings.loadingStyle || 'both';
        if (style === 'none') return;

        // Remove any existing indicators first
        removeLoadingIndicators(parent);

        // Add indicator based on style preference
        if (style === 'ellipsis' || style === 'both') {
            const indicator = createLoadingIndicator('ellipsis');
            parent.appendChild(indicator);
        }
        if (style === 'spinner' || style === 'both') {
            const indicator = createLoadingIndicator('spinner');
            parent.appendChild(indicator);
        }
    };

    item.status = 'translating';
    updateProcessingState(1);
    logger.dom('Processing item:', item.id, item.element);

    item.parts.forEach(part => {
       if (part.status === 'pending') {
           applyLoadingState(part);
       }
    });

    try {
      // Process all parts that need translation
      const pendingParts = item.parts.filter(p => p.status === 'pending' || p.status === 'error');
      
      if (pendingParts.length === 0) {
        item.status = 'success';
        // Note: Don't call updateProcessingState(-1) here, finally block will handle it
        return;
      }

      const targetLanguage = currentSettings.defaultToLang;
      const sourceLanguage = currentSettings.defaultFromLang;

      const [apiId, modelId] = currentSettings.defaultModelId.split(':');
      const modelConfig = currentSettings.apiConfigs
        .find(api => api.id === apiId)
        ?.models.find(model => model.id === modelId);
      const maxParagraphs = Math.max(1, modelConfig?.maxParagraphs ?? 1);

      const applyTranslatedPart = (part: TranslationPart, translatedText: string) => {
        if (item.runId !== translationRunIdRef.current) return;
        const normalized = normalizeTranslationText(part.originalText, translatedText);
        part.translatedText = normalized;
        part.status = 'success';
        // Remove loading indicators and error class
        removeLoadingIndicators(part.node.parentElement);
        part.node.parentElement?.classList.remove('ling-translate-error');
        logger.dom('Updating text node:', part.node);
        if (part.node.textContent !== normalized) {
          part.node.textContent = normalized;
        }
      };

      const markPartError = (part: TranslationPart, error?: unknown) => {
        if (item.runId !== translationRunIdRef.current) return;
        part.status = 'error';
        // Remove loading indicators and add error class
        removeLoadingIndicators(part.node.parentElement);
        part.node.parentElement?.classList.add('ling-translate-error');
        if (error) {
          logger.translation('Part failed:', error);
        }
      };

      const translateSinglePart = async (part: TranslationPart) => {
        if (item.runId !== translationRunIdRef.current) return;
        part.status = 'translating';
        const originalText = part.originalText;
        
        // Check cache first
        const cached = await PageCache.get(
            originalText, 
            sourceLanguage, 
            targetLanguage, 
            currentSettings.defaultModelId
        );

        if (cached) {
            logger.info('Cache hit for:', originalText.substring(0, 20) + '...');
            applyTranslatedPart(part, cached);
            return;
        }

        logger.translation(`Translating part (${sourceLanguage} -> ${targetLanguage}):`, originalText.substring(0, 30) + '...');

        const request: TranslationRequest = {
          type: 'TRANSLATE_TEXT',
          payload: {
            text: originalText,
            from: sourceLanguage,
            to: targetLanguage,
            contentType: 'text',
            modelId: currentSettings.defaultModelId
          }
        };

        try {
          const response = await limiter(async () => {
            const networkStart = Date.now();
            const result = await chrome.runtime.sendMessage(request) as TranslationResponse;
            const networkDuration = Date.now() - networkStart;
            logger.network(`Part request took ${networkDuration}ms`, result.success ? 'Success' : 'Failed');
            return result;
          });

          if (item.runId !== translationRunIdRef.current) return;
          if (response.success && response.data) {
            const cleaned = stripThoughtBlocks(response.data.translatedText ?? '');
            if (!cleaned.trim()) {
              throw new Error('Empty translation result');
            }
            // Save to cache
            await PageCache.set(
                originalText,
                sourceLanguage,
                targetLanguage,
                currentSettings.defaultModelId,
                cleaned
            );
            applyTranslatedPart(part, cleaned);
          } else {
            markPartError(part, response.error);
            throw new Error(response.error || 'Translation failed');
          }
        } catch (err) {
          console.error(err);
          markPartError(part, err);
          throw err;
        }
      };

      const translateBatch = async (batch: TranslationPart[]) => {
        if (item.runId !== translationRunIdRef.current) return;
        
        // Optimize batch: Check cache for all parts
        const uncachedParts: TranslationPart[] = [];
        
        for (const part of batch) {
            const cached = await PageCache.get(
                part.originalText, 
                sourceLanguage, 
                targetLanguage, 
                currentSettings.defaultModelId
            );
            if (cached) {
                part.status = 'translating'; // Temporarily set to translating to pass checks
                applyTranslatedPart(part, cached);
            } else {
                uncachedParts.push(part);
            }
        }

        // If all parts were cached, we are done
        if (uncachedParts.length === 0) return;

        // Only process uncached parts
        if (uncachedParts.length === 1) {
          await translateSinglePart(uncachedParts[0]);
          return;
        }

        uncachedParts.forEach(part => {
          part.status = 'translating';
        });

        const combinedText = uncachedParts.map(part => part.originalText).join(MULTI_SEPARATOR);
        logger.translation(`Translating batch (${sourceLanguage} -> ${targetLanguage}):`, combinedText.substring(0, 30) + '...');

        const request: TranslationRequest = {
          type: 'TRANSLATE_TEXT',
          payload: {
            text: combinedText,
            from: sourceLanguage,
            to: targetLanguage,
            contentType: 'multi',
            modelId: currentSettings.defaultModelId
          }
        };

        const response = await limiter(async () => {
          const networkStart = Date.now();
          const result = await chrome.runtime.sendMessage(request) as TranslationResponse;
          const networkDuration = Date.now() - networkStart;
          logger.network(`Batch request took ${networkDuration}ms`, result.success ? 'Success' : 'Failed');
          return result;
        });

        if (item.runId !== translationRunIdRef.current) return;
        if (!response.success || !response.data) {
          uncachedParts.forEach(part => markPartError(part, response.error));
          throw new Error(response.error || 'Translation failed');
        }

        const cleaned = stripThoughtBlocks(response.data.translatedText ?? '');
        if (!cleaned.trim()) {
          uncachedParts.forEach(part => markPartError(part, 'Empty translation result'));
          throw new Error('Empty translation result');
        }

        const segments = splitMultiTranslation(cleaned);
        const hasEmptySegment = segments.some(segment => !segment);
        if (segments.length !== uncachedParts.length || hasEmptySegment) {
          logger.translation('Batch segment mismatch', { expected: uncachedParts.length, actual: segments.length });
          await Promise.all(uncachedParts.map(part => translateSinglePart(part)));
          return;
        }

        segments.forEach(async (segment, index) => {
          const part = uncachedParts[index];
          // Cache each segment
          await PageCache.set(
            part.originalText,
            sourceLanguage,
            targetLanguage,
            currentSettings.defaultModelId,
            segment
          );
          applyTranslatedPart(part, segment);
        });
      };

      const batches = chunkParts(pendingParts, maxParagraphs);
      await Promise.all(batches.map(batch => translateBatch(batch)));
      
      // Check if all parts success
      const allSuccess = item.parts.every(p => p.status === 'success');
      const anyError = item.parts.some(p => p.status === 'error');
      
      if (allSuccess) {
         item.status = 'success';
         // Clean up all loading indicators
         item.parts.forEach(part => {
             removeLoadingIndicators(part.node.parentElement);
         });
         if (item.runId !== translationRunIdRef.current) return;
         item.element.setAttribute('data-translated', 'true');
         item.element.setAttribute('data-translated-lang', targetLanguage);
         item.element.setAttribute('title', '已翻译');
      } else if (anyError) {
         throw new Error('Some parts failed to translate');
      }
    } catch (error) {
      console.error('Translation error:', error);
      
      // Check for Extension Context Invalidated error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Extension context invalidated') || errorMessage.includes('context invalidated')) {
        if (!window['__ling_translate_context_alert_shown']) {
            window['__ling_translate_context_alert_shown'] = true;
            alert('扩展已更新或重新加载。请刷新页面以继续使用 Ling 翻译。');
        }
        // Stop retrying
        item.status = 'error';
        // Note: Don't call updateProcessingState(-1) here, finally block will handle it
        return;
      }

      item.retryCount++;
      if (item.retryCount < MAX_RETRIES) {
        item.status = 'pending'; // Reset to pending to retry
        // Restore original text and clean up indicators before retry
        item.parts.forEach(part => {
            if (part.status === 'error') {
                part.status = 'pending';
                removeLoadingIndicators(part.node.parentElement);
                part.node.parentElement?.classList.remove('ling-translate-error');
                if (part.node.textContent !== part.originalText) {
                    part.node.textContent = part.originalText;
                }
            }
        });
        logger.info(`Retrying translation for item ${item.id} (Attempt ${item.retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          if (item.runId !== translationRunIdRef.current) return;
          processTranslation(item);
        }, 1000 * Math.min(item.retryCount, 5));
      } else {
        item.status = 'error';
        // Reset text content and clean up indicators on error
        item.parts.forEach(part => {
             removeLoadingIndicators(part.node.parentElement);
             part.node.parentElement?.classList.remove('ling-translate-error');
             if (part.node.textContent !== part.originalText) {
                 part.node.textContent = part.originalText;
             }
        });
        logger.info(`Translation failed permanently for item ${item.id}`);
      }
    } finally {
       updateProcessingState(-1);
       // No cleanup needed for text suffix
    }
  }, [updateProcessingState]);

  const cancelTranslation = useCallback(() => {
    translationRunIdRef.current += 1;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    limiterRef.current = null;

    const itemsMap = translationItemsRef.current;
    itemsMap.forEach((item) => {
      item.parts.forEach(part => {
        removeLoadingIndicators(part.node.parentElement);
        part.node.parentElement?.classList.remove('ling-translate-error');
        if (part.node.textContent !== part.originalText) {
          part.node.textContent = part.originalText;
        }
        part.status = 'pending';
        part.translatedText = undefined;
      });

      item.status = 'idle';
      item.retryCount = 0;
      item.isVisible = false;

      item.element.removeAttribute('data-translated');
      item.element.removeAttribute('data-translated-lang');
      const currentTitle = item.element.getAttribute('title');
      if (currentTitle === '已翻译') {
        if (item.originalTitle === null) {
          item.element.removeAttribute('title');
        } else {
          item.element.setAttribute('title', item.originalTitle);
        }
      }
    });

    translationItemsRef.current = new Map();
    setIsTranslating(false);
    setIsTranslationEnabled(false);
  }, []);

  const handleTranslate = useCallback(async () => {
    if (isTranslationEnabled) {
      cancelTranslation();
      return;
    }
    if (isTranslating) return;
    
    // Cleanup previous observer if exists
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    translationRunIdRef.current += 1;
    const runId = translationRunIdRef.current;
    
    await loadSettings();
    if (runId !== translationRunIdRef.current) return;
    const currentSettings = useStore.getState().settings;

    if (!currentSettings.defaultModelId) {
      if (confirm('尚未选择翻译模型，是否立即配置？')) {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
      }
      return;
    }

    setIsTranslating(true);
    setIsTranslationEnabled(true);
    
    // Setup Limiter
    const [apiId, modelId] = currentSettings.defaultModelId.split(':');
    const modelConfig = currentSettings.apiConfigs
      .find(api => api.id === apiId)
      ?.models.find(model => model.id === modelId);
      
    const concurrency = Math.max(1, modelConfig?.concurrency ?? 4);
    const requestsPerSecond = Math.max(1, modelConfig?.requestsPerSecond ?? 12);
    limiterRef.current = createRequestLimiter(concurrency, requestsPerSecond);
    if (runId !== translationRunIdRef.current) return;

    // 1. Scan DOM
    const groups = await getAllTranslatableGroups();
    if (runId !== translationRunIdRef.current) return;
    const itemsMap = new Map<HTMLElement, TranslationItem>();

    groups.forEach((textNodes, element) => {
      // Create parts from textNodes
      const parts = textNodes.map(node => ({
        node,
        originalText: node.textContent || '',
        status: 'pending' as const
      })).filter(p => p.originalText.trim().length > 0);

      if (parts.length === 0) return;

      itemsMap.set(element, {
        id: Math.random().toString(36).substr(2, 9),
        element,
        runId,
        originalTitle: element.getAttribute('title'),
        parts,
        status: 'pending',
        retryCount: 0,
        isVisible: false
      });

      // Apply loading indicator immediately for all pending items
      const loadingStyle = currentSettings.loadingStyle || 'both';
      if (loadingStyle !== 'none') {
          parts.forEach(part => {
              const parent = part.node.parentElement;
              if (parent) {
                  if (loadingStyle === 'ellipsis' || loadingStyle === 'both') {
                      const indicator = createLoadingIndicator('ellipsis');
                      parent.appendChild(indicator);
                  }
                  if (loadingStyle === 'spinner' || loadingStyle === 'both') {
                      const indicator = createLoadingIndicator('spinner');
                      parent.appendChild(indicator);
                  }
              }
          });
      }
    });

    translationItemsRef.current = itemsMap;
    if (runId !== translationRunIdRef.current) return;

    // 2. Setup IntersectionObserver with improved configuration
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const item = itemsMap.get(entry.target as HTMLElement);
        if (!item) return;
        if (item.runId !== translationRunIdRef.current) return;

        if (entry.isIntersecting) {
            // Only trigger if not already processing or completed
            if (item.status === 'pending') {
                item.isVisible = true;
                processTranslation(item);
            }
        } else {
            item.isVisible = false;
        }
      });
    }, {
        rootMargin: '300px',
        threshold: 0.01
    });

    if (runId !== translationRunIdRef.current) {
      observer.disconnect();
      return;
    }
    observerRef.current = observer;

    // 3. Immediately translate visible elements (above the fold)
    itemsMap.forEach((item) => {
        if (item.runId !== translationRunIdRef.current) return;
        const rect = item.element.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
        if (isInViewport) {
            if (item.status === 'pending') {
                processTranslation(item);
            }
        } else {
            observer.observe(item.element);
        }
    });

    // Note: We don't set isTranslating to false immediately because the process is continuous (scroll-based).
    // But we might want to toggle the button state?
    // User requirement: "Translation execution logic...".
    // If we leave the button as "Translating..." forever, it might be confusing.
    // Maybe change button to "Stop" or just reset it after initialization?
    // Let's keep it 'true' while we are in "Translation Mode".
    // But maybe we should allow "Scanning done" state?
    // For now, let's keep it simple: The button triggered the "mode".
    // We can set isTranslating to false after scanning, but the observers keep running.
    setIsTranslating(false); 
  }, [cancelTranslation, isTranslating, isTranslationEnabled, loadSettings, processTranslation]);

  // Check for auto-translate after settings are loaded
  useEffect(() => {
    if (!autoTranslateTriggered.current && settings.autoTranslateDomains?.includes(window.location.hostname)) {
      setTimeout(() => {
        handleTranslate();
      }, 500);
      autoTranslateTriggered.current = true;
    }
  }, [handleTranslate, settings.autoTranslateDomains]);

  const supportedLanguages = [
    { code: 'zh-CN', name: '中文（简体）' },
    { code: 'en', name: '英语' },
    { code: 'ja', name: '日语' },
    { code: 'ko', name: '韩语' },
    { code: 'fr', name: '法语' },
    { code: 'de', name: '德语' },
    { code: 'es', name: '西班牙语' },
    { code: 'ru', name: '俄语' },
    { code: 'pt', name: '葡萄牙语' },
    { code: 'it', name: '意大利语' },
  ];

  // Flatten models for selection
  const availableModels = settings.apiConfigs.flatMap(api => 
    api.models.map(model => ({
      id: `${api.id}:${model.id}`,
      name: `${model.name} (${api.name})`
    }))
  );

  // Draggable State
  const [position, setPosition] = useState<{ x: number; y: number; isRight?: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
    initialWidth: number;
    initialHeight: number;
    hasMoved: boolean;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;

    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Threshold check to distinguish click from drag
    if (!dragRef.current.hasMoved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragRef.current.hasMoved) {
      // Calculate new position (always absolute for dragging)
      let newX = initialLeft + dx;
      let newY = initialTop + dy;

      // Boundary checks
      const width = dragRef.current.initialWidth;
      const height = dragRef.current.initialHeight;
      const maxX = window.innerWidth - width;
      const maxY = window.innerHeight - height;
      
      newX = Math.min(Math.max(0, newX), maxX);
      newY = Math.min(Math.max(0, newY), maxY);

      setPosition({ x: newX, y: newY, isRight: false });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current?.hasMoved && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const width = rect.width;
      const maxX = window.innerWidth - width;
      const currentX = rect.left;
      
      // Snapping logic: if close to right edge, snap to right
      const snapThreshold = 30;
      if (currentX > maxX - snapThreshold) {
        setPosition({
          x: 0, // Distance from right
          y: rect.top,
          isRight: true
        });
      } else if (currentX < snapThreshold) {
        setPosition({
          x: 0, // Distance from left
          y: rect.top,
          isRight: false
        });
      } else {
        setPosition({
          x: currentX,
          y: rect.top,
          isRight: false
        });
      }
    }

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    
    setIsDragging(false);
    
    // Delay clearing dragRef to allow onClickCapture to check hasMoved
    setTimeout(() => {
        dragRef.current = null;
    }, 0);
  }, [handleMouseMove]);

  // Handle window resize to keep floating button in bounds
  useEffect(() => {
    const handleResize = () => {
      if (!position || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      setPosition(prev => {
        if (!prev) return null;
        
        let newX = prev.x;
        let newY = Math.min(Math.max(0, prev.y), maxY);
        let isRight = prev.isRight;
        
        if (prev.isRight) {
          // Keep at right edge if it was snapped or within bounds
          // When snapped to right, x is distance from right edge (usually 0)
          // We don't need to change x or isRight
        } else {
          // Left-aligned mode (x is distance from left)
          // Check if we are being pushed against the right edge or overflowing
          if (newX >= maxX - 5) { // 5px threshold for auto-snap
             // Switch to right-snap mode
             newX = 0;
             isRight = true;
          } else {
             // Keep at left side within bounds
             newX = Math.min(Math.max(0, prev.x), maxX);
          }
        }
        
        return { ...prev, x: newX, y: newY, isRight };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow left click
    if (e.button !== 0) return;
    
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    
    // Always use current visual position for starting drag
    const initialLeft = rect.left;
    const initialTop = rect.top;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft,
      initialTop,
      initialWidth: rect.width,
      initialHeight: rect.height,
      hasMoved: false,
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (dragRef.current?.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const getThemeStyle = (type: 'floating' | 'settingsPanel' | 'settingsButton') => {
    const { theme } = settings;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const mode = theme?.mode ?? ((theme?.floatingWallpaper || theme?.settingsWallpaper) ? 'wallpaper' : 'frosted');
    const frostedTone = theme?.frostedTone ?? (systemPrefersDark ? 'dark' : 'light');
    const frostedOpacity = Math.min(1, Math.max(0, theme?.frostedOpacity ?? (frostedTone === 'dark' ? 0.72 : 0.82)));

    const frostedBackgroundColor =
      frostedTone === 'dark'
        ? `rgba(17, 24, 39, ${frostedOpacity})`
        : `rgba(255, 255, 255, ${frostedOpacity})`;
    const frostedBorderColor = frostedTone === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.22)';

    const frostedStyle = {
      backgroundColor: frostedBackgroundColor,
      backdropFilter: 'blur(12px) saturate(140%)',
      WebkitBackdropFilter: 'blur(12px) saturate(140%)',
      border: `1px solid ${frostedBorderColor}`,
    } as const;

    if (mode === 'frosted') return frostedStyle;

    const wallpaper = (() => {
      if (type === 'floating') return theme?.floatingWallpaper || null;
      if (type === 'settingsPanel') return theme?.settingsWallpaper || null;
      if (type === 'settingsButton') {
        return theme?.syncFloatingWallpaperToSettingsButton ? (theme?.floatingWallpaper || null) : null;
      }
      return null;
    })();
    if (!wallpaper) return frostedStyle;

    const maskType = theme?.maskType ?? 'auto';
    const maskIsDark = maskType === 'dark' || (maskType === 'auto' && systemPrefersDark);
    const maskColor = maskIsDark ? '30, 58, 138' : '255, 255, 255';
    const opacity = Math.min(1, Math.max(0, theme?.maskOpacity ?? 0.9));
    const background = `linear-gradient(rgba(${maskColor}, ${opacity}), rgba(${maskColor}, ${opacity})), url(${wallpaper})`;

    return {
      backgroundImage: background,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    };
  };

  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const themeMode = settings.theme?.mode ?? ((settings.theme?.floatingWallpaper || settings.theme?.settingsWallpaper) ? 'wallpaper' : 'frosted');
  const frostedTone = settings.theme?.frostedTone ?? (systemPrefersDark ? 'dark' : 'light');
  const maskType = settings.theme?.maskType ?? 'auto';
  const wallpaperMaskIsDark = maskType === 'dark' || (maskType === 'auto' && systemPrefersDark);
  const settingsPanelIsDark = themeMode === 'frosted' ? frostedTone === 'dark' : wallpaperMaskIsDark;
  const floatingUsesWallpaper = themeMode === 'wallpaper' && !!settings.theme?.floatingWallpaper;
  const settingsButtonUsesWallpaper = themeMode === 'wallpaper' && !!settings.theme?.syncFloatingWallpaperToSettingsButton && !!settings.theme?.floatingWallpaper;
  const frostedIconColor = frostedTone === 'light' ? 'text-gray-900' : 'text-white';
  const floatingIconClass = floatingUsesWallpaper ? 'text-white mix-blend-difference' : frostedIconColor;
  const settingsIconClass = settingsButtonUsesWallpaper ? 'text-white mix-blend-difference' : frostedIconColor;
  const panelTextClass = settingsPanelIsDark ? 'text-white' : 'text-gray-900';
  const panelMutedTextClass = settingsPanelIsDark ? 'text-gray-300' : 'text-gray-500';
  const panelLabelTextClass = settingsPanelIsDark ? 'text-gray-200' : 'text-gray-500';
  const panelSelectClass = cn(
    'w-full rounded-md p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-sm',
    settingsPanelIsDark ? 'bg-gray-900/50 border border-white/15 text-white' : 'bg-white/50 border border-gray-200 text-gray-900'
  );

  const isAutoTranslate = settings.autoTranslateDomains?.includes(window.location.hostname);

  const toggleAutoTranslate = () => {
    const hostname = window.location.hostname;
    const currentDomains = settings.autoTranslateDomains || [];
    const newDomains = currentDomains.includes(hostname)
      ? currentDomains.filter(d => d !== hostname)
      : [...currentDomains, hostname];
    updateSettings({ autoTranslateDomains: newDomains });
  };

  // Keyboard Shortcut Listener
  useEffect(() => {
    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
        // Track pressed keys
        const normalized = normalizeKey(e.key);
        pressedKeys.add(normalized);
        
        // Construct current combination
        const currentCombo = sortKeys(Array.from(pressedKeys)).join('+');
        
        // Target shortcut
        const targetShortcut = settings.shortcuts?.translate || 'Alt+A';
        // Normalize target as well (ensure sorted)
        const targetParts = targetShortcut.split('+');
        const normalizedTarget = sortKeys(targetParts).join('+');

        if (currentCombo === normalizedTarget) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle Logic
            if (isTranslationEnabled) {
                cancelTranslation();
            } else {
                handleTranslate();
            }
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        const normalized = normalizeKey(e.key);
        pressedKeys.delete(normalized);
    };
    
    // Clear on blur to prevent stuck keys
    const handleBlur = () => {
        pressedKeys.clear();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleBlur);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
        window.removeEventListener('keyup', handleKeyUp, { capture: true });
        window.removeEventListener('blur', handleBlur);
    };
  }, [settings.shortcuts, isTranslationEnabled, handleTranslate, cancelTranslation]);

  if (isHidden) return null;
  if (settings.hideGlobalButton) return null;
  if (settings.hideDomains?.includes(window.location.hostname)) return null;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed flex flex-col items-center gap-2 font-sans text-gray-900 z-[9999]",
        !position && "top-1/2 right-0 -translate-y-1/2", // Initial position
        isDragging && "cursor-move"
      )}
      style={position ? { 
        left: position.isRight ? undefined : position.x, 
        right: position.isRight ? position.x : undefined,
        top: position.y 
      } : undefined}
      onMouseDown={handleMouseDown}
      onClickCapture={handleClickCapture}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Quick Settings Menu */}
      {showMenu && (
        <div 
            className="absolute bottom-full mb-2 right-0 w-72 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 animate-in slide-in-from-bottom-2 z-[100] text-left overflow-hidden"
            style={getThemeStyle('settingsPanel')}
        >
           <div className="flex justify-between items-center mb-4">
             <h3 className={cn("font-bold bg-transparent", panelTextClass)}>快捷设置</h3>
             <button
               onClick={() => setShowMenu(false)}
               className={cn(
                 "transition-colors",
                 settingsPanelIsDark ? "text-gray-300 hover:text-white" : "text-gray-500 hover:text-gray-700"
               )}
             >
               <X className="w-4 h-4" />
             </button>
           </div>
           
           <div className="space-y-4">
              <label
                className={cn(
                  "flex items-center gap-2 text-sm font-medium cursor-pointer p-2 rounded-lg transition-colors",
                  settingsPanelIsDark ? "text-gray-100 bg-white/5 hover:bg-white/10" : "text-gray-700 bg-black/5 hover:bg-black/10"
                )}
              >
                <input 
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                  checked={isAutoTranslate}
                  onChange={toggleAutoTranslate}
                />
                自动翻译此网站
              </label>

              <div>
                 <label className={cn("block text-xs font-medium mb-1", panelLabelTextClass)}>目标语言</label>
                 <select 
                   className={panelSelectClass}
                   value={settings.defaultToLang}
                   onChange={(e) => updateSettings({ defaultToLang: e.target.value })}
                 >
                   {supportedLanguages.map(lang => (
                     <option key={lang.code} value={lang.code}>{lang.name}</option>
                   ))}
                 </select>
              </div>

              <div>
                 <label className={cn("block text-xs font-medium mb-1", panelLabelTextClass)}>模型</label>
                 <select 
                   className={panelSelectClass}
                   value={settings.defaultModelId}
                   onChange={(e) => updateSettings({ defaultModelId: e.target.value })}
                 >
                   <option value="">选择模型...</option>
                   {availableModels.map(model => (
                     <option key={model.id} value={model.id}>{model.name}</option>
                   ))}
                 </select>
              </div>

              <button
                className={cn(
                  "flex items-center gap-2 text-sm font-medium w-full p-2 rounded-lg transition-colors text-left",
                  settingsPanelIsDark ? "text-gray-100 bg-white/5 hover:bg-white/10" : "text-gray-700 bg-black/5 hover:bg-black/10"
                )}
                onClick={() => setIsHidden(true)}
              >
                <EyeOff className="w-4 h-4" />
                暂时隐藏
              </button>
              
              <button
                className={cn(
                  "flex items-center gap-2 text-sm font-medium w-full p-2 rounded-lg transition-colors text-left",
                  settingsPanelIsDark ? "text-gray-100 bg-white/5 hover:bg-white/10" : "text-gray-700 bg-black/5 hover:bg-black/10"
                )}
                onClick={() => {
                    const hostname = window.location.hostname;
                    const current = settings.hideDomains || [];
                    if (!current.includes(hostname)) {
                        updateSettings({ hideDomains: [...current, hostname] });
                    }
                }}
              >
                <EyeOff className="w-4 h-4" />
                在此网站隐藏
              </button>

              <button
                className={cn(
                  "flex items-center gap-2 text-sm font-medium w-full p-2 rounded-lg transition-colors text-left",
                  settingsPanelIsDark ? "text-gray-100 bg-white/5 hover:bg-white/10" : "text-gray-700 bg-black/5 hover:bg-black/10"
                )}
                onClick={() => updateSettings({ hideGlobalButton: true })}
              >
                <EyeOff className="w-4 h-4" />
                永久隐藏
              </button>

              <button 
                className="w-full py-2 text-sm text-primary hover:bg-primary/10 rounded-md transition-colors font-medium" 
                onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })}
              >
                 更多设置
              </button>
              
              <div className="pt-4 border-t border-gray-100/20 dark:border-gray-700/20">
                <div className="flex items-center justify-between mb-2">
                   <h4 className={cn("text-xs font-semibold flex items-center gap-1", panelMutedTextClass)}>
                     <Terminal className="w-3 h-3" /> 开发者模式
                   </h4>
                   <label className="relative inline-flex items-center cursor-pointer">
                     <input 
                       type="checkbox" 
                       className="sr-only peer"
                       checked={settings.developer?.enabled ?? false}
                       onChange={(e) => updateSettings({ 
                         developer: { ...settings.developer, enabled: e.target.checked } 
                       })}
                     />
                     <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                   </label>
                </div>
                
                {(settings.developer?.enabled) && (
                  <div className="space-y-2 pl-1">
                    <label className={cn("flex items-center gap-2 text-xs cursor-pointer", settingsPanelIsDark ? "text-gray-200" : "text-gray-600")}>
                      <input 
                        type="checkbox"
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        checked={settings.developer?.logDom ?? false}
                        onChange={(e) => updateSettings({ 
                          developer: { ...settings.developer, logDom: e.target.checked } 
                        })}
                      />
                      记录 DOM 操作
                    </label>
                    <label className={cn("flex items-center gap-2 text-xs cursor-pointer", settingsPanelIsDark ? "text-gray-200" : "text-gray-600")}>
                      <input 
                        type="checkbox"
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        checked={settings.developer?.logTranslation ?? false}
                        onChange={(e) => updateSettings({ 
                          developer: { ...settings.developer, logTranslation: e.target.checked } 
                        })}
                      />
                      记录翻译内容
                    </label>
                    <label className={cn("flex items-center gap-2 text-xs cursor-pointer", settingsPanelIsDark ? "text-gray-200" : "text-gray-600")}>
                      <input 
                        type="checkbox"
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        checked={settings.developer?.logNetwork ?? false}
                        onChange={(e) => updateSettings({ 
                          developer: { ...settings.developer, logNetwork: e.target.checked } 
                        })}
                      />
                      记录网络请求
                    </label>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {/* Settings Button */}
      <div className={cn(
        "transition-all duration-300 ease-in-out transform absolute bottom-12 z-0",
        isHovered || showMenu ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      )}>
         <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full shadow-lg flex items-center justify-center transition-colors border border-gray-100/20 dark:border-gray-600/20"
            style={getThemeStyle('settingsButton')}
            title="设置"
         >
           <Settings className={cn("w-4 h-4", settingsIconClass)} />
         </button>
      </div>

      {/* Main FAB */}
      <button
        onClick={handleTranslate}
        disabled={isTranslating && !isTranslationEnabled}
        className={cn(
          "w-10 h-10 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 z-50 relative active:scale-95",
          isTranslating && !isTranslationEnabled && "cursor-wait opacity-80",
          isTranslationEnabled && "ring-2 ring-emerald-400/35"
        )}
        style={getThemeStyle('floating')}
      >
        {isTranslationEnabled && (
          <span className="absolute inset-0 rounded-full bg-emerald-400/20 pointer-events-none" />
        )}
        {isTranslating || isProcessing ? (
          <Loader2 className={cn("w-5 h-5 animate-spin", floatingIconClass)} />
        ) : (
          <Languages className={cn("w-5 h-5", floatingIconClass)} />
        )}
      </button>
    </div>
  );
};

export default ContentApp;
