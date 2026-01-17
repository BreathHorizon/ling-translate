import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Languages, Settings, Loader2, X, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils'
import { TranslationRequest, TranslationResponse, UserSettings } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { logger } from '@/lib/logger';

const MAX_RETRIES = 3;
const MULTI_SEPARATOR = '\n\n%%\n\n';
const MULTI_SEPARATOR_REGEX = /\n\s*%%\s*\n/;

interface TranslationItem {
  id: string;
  element: HTMLElement;
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

// CSS-based loading indicator to avoid modifying DOM textContent
let stylesInjected = false;

const injectStyles = () => {
  if (stylesInjected) return;
  stylesInjected = true;

  const styleId = 'ling-translate-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .ling-translate-loading::after {
      content: '...';
      animation: ling-translate-pulse 1.5s infinite;
      margin-left: 2px;
      font-weight: normal;
      opacity: 0.7;
    }
    @keyframes ling-translate-pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
    .ling-translate-error {
      color: #ef4444;
      border-bottom: 1px dotted #ef4444;
    }
  `;
  document.head.appendChild(style);
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
  const [isTranslating, setIsTranslating] = useState(false);
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

  // Auto-translate State
  const autoTranslateTriggered = useRef(false);

  useEffect(() => {
    const init = async () => {
      await loadSettings();
      injectStyles();
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
    if (item.status === 'translating' || item.status === 'success') return;

    const currentSettings = useStore.getState().settings;
    const limiter = limiterRef.current;
    
    if (!limiter) return;

    item.status = 'translating';
    logger.dom('Processing item:', item.id, item.element);

    // Use CSS class for loading state instead of modifying textContent
    if (currentSettings.showLoadingIcon) {
        item.parts.forEach(part => {
           if (part.status === 'pending' && part.node.parentElement) {
               part.node.parentElement.classList.add('ling-translate-loading');
           }
        });
        logger.dom('Applied loading indicator for item:', item.id);
    }

    try {
      // Process all parts that need translation
      const pendingParts = item.parts.filter(p => p.status === 'pending' || p.status === 'error');
      
      if (pendingParts.length === 0) {
        item.status = 'success';
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
        const normalized = normalizeTranslationText(part.originalText, translatedText);
        part.translatedText = normalized;
        part.status = 'success';
        if (part.node.parentElement) {
          part.node.parentElement.classList.remove('ling-translate-loading', 'ling-translate-error');
        }
        logger.dom('Updating text node:', part.node);
        if (part.node.textContent !== normalized) {
          part.node.textContent = normalized;
        }
      };

      const markPartError = (part: TranslationPart, error?: unknown) => {
        part.status = 'error';
        if (part.node.parentElement) {
          part.node.parentElement.classList.remove('ling-translate-loading');
          part.node.parentElement.classList.add('ling-translate-error');
        }
        if (error) {
          logger.translation('Part failed:', error);
        }
      };

      const translateSinglePart = async (part: TranslationPart) => {
        part.status = 'translating';
        const originalText = part.originalText;
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

          if (response.success && response.data) {
            const cleaned = stripThoughtBlocks(response.data.translatedText ?? '');
            if (!cleaned.trim()) {
              throw new Error('Empty translation result');
            }
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
        if (batch.length === 1) {
          await translateSinglePart(batch[0]);
          return;
        }

        batch.forEach(part => {
          part.status = 'translating';
        });

        const combinedText = batch.map(part => part.originalText).join(MULTI_SEPARATOR);
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

        if (!response.success || !response.data) {
          batch.forEach(part => markPartError(part, response.error));
          throw new Error(response.error || 'Translation failed');
        }

        const cleaned = stripThoughtBlocks(response.data.translatedText ?? '');
        if (!cleaned.trim()) {
          batch.forEach(part => markPartError(part, 'Empty translation result'));
          throw new Error('Empty translation result');
        }

        const segments = splitMultiTranslation(cleaned);
        const hasEmptySegment = segments.some(segment => !segment);
        if (segments.length !== batch.length || hasEmptySegment) {
          logger.translation('Batch segment mismatch', { expected: batch.length, actual: segments.length });
          await Promise.all(batch.map(part => translateSinglePart(part)));
          return;
        }

        segments.forEach((segment, index) => {
          applyTranslatedPart(batch[index], segment);
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
             if (part.node.parentElement) {
                 part.node.parentElement.classList.remove('ling-translate-loading');
             }
         });
         item.element.setAttribute('data-translated', 'true');
         item.element.setAttribute('data-translated-lang', targetLanguage);
         item.element.setAttribute('title', 'Translated');
      } else if (anyError) {
         throw new Error('Some parts failed to translate');
      }
    } catch (error) {
      console.error('Translation error:', error);
      item.retryCount++;
      if (item.retryCount < MAX_RETRIES) {
        item.status = 'pending'; // Reset to pending to retry
        // Restore original text and clean up classes before retry
        item.parts.forEach(part => {
            if (part.status === 'error') {
                part.status = 'pending';
                if (part.node.parentElement) {
                    part.node.parentElement.classList.remove('ling-translate-loading', 'ling-translate-error');
                }
                if (part.node.textContent !== part.originalText) {
                    part.node.textContent = part.originalText;
                }
            }
        });
        logger.info(`Retrying translation for item ${item.id} (Attempt ${item.retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => processTranslation(item), 1000 * Math.min(item.retryCount, 5));
      } else {
        item.status = 'error';
        // Reset text content and clean up CSS classes on error
        item.parts.forEach(part => {
             if (part.node.parentElement) {
                 part.node.parentElement.classList.remove('ling-translate-loading', 'ling-translate-error');
             }
             if (part.node.textContent !== part.originalText) {
                 part.node.textContent = part.originalText;
             }
        });
        logger.info(`Translation failed permanently for item ${item.id}`);
      }
    } finally {
       // No cleanup needed for text suffix
    }
  }, []);

  const handleTranslate = useCallback(async () => {
    if (isTranslating) return;
    
    // Cleanup previous observer if exists
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    
    await loadSettings();
    const currentSettings = useStore.getState().settings;

    if (!currentSettings.defaultModelId) {
      if (confirm('No translation model selected. Configure now?')) {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
      }
      return;
    }

    setIsTranslating(true);
    
    // Setup Limiter
    const [apiId, modelId] = currentSettings.defaultModelId.split(':');
    const modelConfig = currentSettings.apiConfigs
      .find(api => api.id === apiId)
      ?.models.find(model => model.id === modelId);
      
    const concurrency = Math.max(1, modelConfig?.concurrency ?? 4);
    const requestsPerSecond = Math.max(1, modelConfig?.requestsPerSecond ?? 12);
    limiterRef.current = createRequestLimiter(concurrency, requestsPerSecond);

    // 1. Scan DOM
    const groups = await getAllTranslatableGroups();
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
        parts,
        status: 'pending',
        retryCount: 0,
        isVisible: false
      });
    });

    translationItemsRef.current = itemsMap;

    // 2. Setup IntersectionObserver with improved configuration
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const item = itemsMap.get(entry.target as HTMLElement);
        if (!item) return;

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

    observerRef.current = observer;

    // 3. Immediately translate visible elements (above the fold)
    itemsMap.forEach((item) => {
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
  }, [isTranslating, loadSettings, processTranslation]);

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
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'es', name: 'Spanish' },
    { code: 'ru', name: 'Russian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'it', name: 'Italian' },
  ];

  // Flatten models for selection
  const availableModels = settings.apiConfigs.flatMap(api => 
    api.models.map(model => ({
      id: `${api.id}:${model.id}`,
      name: `${model.name} (${api.name})`
    }))
  );

  // Draggable State
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
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
      // Calculate new position
      let newX = initialLeft + dx;
      let newY = initialTop + dy;

      // Boundary checks
      const width = dragRef.current.initialWidth;
      const height = dragRef.current.initialHeight;
      const maxX = document.documentElement.clientWidth - width;
      const maxY = document.documentElement.clientHeight - height;
      
      newX = Math.min(Math.max(0, newX), maxX);
      newY = Math.min(Math.max(0, newY), maxY);

      setPosition({ x: newX, y: newY });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    
    setIsDragging(false);
    
    // Delay clearing dragRef to allow onClickCapture to check hasMoved
    setTimeout(() => {
        dragRef.current = null;
    }, 0);
  }, [handleMouseMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow left click
    if (e.button !== 0) return;
    
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    
    // If position is null (initial state), use the current rect
    const initialLeft = position ? position.x : rect.left;
    const initialTop = position ? position.y : rect.top;

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

  const getThemeStyle = (type: 'floating' | 'settings') => {
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

    const wallpaper = type === 'floating' ? theme?.floatingWallpaper : theme?.settingsWallpaper;
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
  const settingsUsesWallpaper = themeMode === 'wallpaper' && !!settings.theme?.settingsWallpaper;
  const frostedIconColor = frostedTone === 'light' ? 'text-gray-900' : 'text-white';
  const floatingIconClass = floatingUsesWallpaper ? 'text-white mix-blend-difference' : frostedIconColor;
  const settingsIconClass = settingsUsesWallpaper ? 'text-white mix-blend-difference' : frostedIconColor;
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

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed flex flex-col items-center gap-2 font-sans text-gray-900 z-[9999]",
        !position && "top-1/2 right-0 -translate-y-1/2", // Initial position
        isDragging && "cursor-move"
      )}
      style={position ? { left: position.x, top: position.y } : undefined}
      onMouseDown={handleMouseDown}
      onClickCapture={handleClickCapture}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Quick Settings Menu */}
      {showMenu && (
        <div 
            className="absolute bottom-full mb-2 right-0 w-72 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 animate-in slide-in-from-bottom-2 z-[100] text-left overflow-hidden"
            style={getThemeStyle('settings')}
        >
           <div className="flex justify-between items-center mb-4">
             <h3 className={cn("font-bold bg-transparent", panelTextClass)}>Quick Settings</h3>
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
                Auto-translate this site
              </label>

              <div>
                 <label className={cn("block text-xs font-medium mb-1", panelLabelTextClass)}>Target Language</label>
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
                 <label className={cn("block text-xs font-medium mb-1", panelLabelTextClass)}>Model</label>
                 <select 
                   className={panelSelectClass}
                   value={settings.defaultModelId}
                   onChange={(e) => updateSettings({ defaultModelId: e.target.value })}
                 >
                   <option value="">Select a model...</option>
                   {availableModels.map(model => (
                     <option key={model.id} value={model.id}>{model.name}</option>
                   ))}
                 </select>
              </div>

              <button 
                className="w-full py-2 text-sm text-primary hover:bg-primary/10 rounded-md transition-colors font-medium" 
                onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })}
              >
                 More Settings
              </button>
              
              <div className="pt-4 border-t border-gray-100/20 dark:border-gray-700/20">
                <div className="flex items-center justify-between mb-2">
                   <h4 className={cn("text-xs font-semibold flex items-center gap-1", panelMutedTextClass)}>
                     <Terminal className="w-3 h-3" /> Developer Mode
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
                      Log DOM Operations
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
                      Log Translation Content
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
                      Log Network Requests
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
            style={getThemeStyle('settings')}
            title="Settings"
         >
           <Settings className={cn("w-4 h-4", settingsIconClass)} />
         </button>
      </div>

      {/* Main FAB */}
      <button
        onClick={handleTranslate}
        disabled={isTranslating}
        className={cn(
          "w-10 h-10 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 z-50 relative active:scale-95",
          isTranslating && "cursor-wait opacity-80"
        )}
        style={getThemeStyle('floating')}
      >
        {isTranslating ? (
          <Loader2 className={cn("w-5 h-5 animate-spin", floatingIconClass)} />
        ) : (
          <Languages className={cn("w-5 h-5", floatingIconClass)} />
        )}
      </button>
    </div>
  );
};

export default ContentApp;
