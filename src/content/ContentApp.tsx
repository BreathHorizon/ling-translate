import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Languages, Settings, Loader2, X, AlertCircle, RefreshCw, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TranslationRequest, TranslationResponse } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { logger } from '@/lib/logger';

const MIN_LOADING_MS = 300; // Increased slightly for better visual stability
const SCROLL_THROTTLE_MS = 300;
const MAX_RETRIES = 3;

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

// Custom SVG Spinner to match requirements (16x16)
// Removed spinner logic as per new requirements

// Inject styles for spinner animation and badge
const injectStyles = () => {
  const styleId = 'ling-translate-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .ling-translate-error {
      color: #ef4444;
      cursor: help;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
};

// attachLoadingBadge removed

const getAllTranslatableGroups = () => {
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

const ContentApp: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { settings, loadSettings, updateSettings } = useStore();

  // Translation State
  const translationItemsRef = useRef<Map<HTMLElement, TranslationItem>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const limiterRef = useRef<ReturnType<typeof createRequestLimiter> | null>(null);

  useEffect(() => {
    loadSettings();
    injectStyles();
    return () => {
      observerRef.current?.disconnect();
    };
  }, [loadSettings]);

  useEffect(() => {
    if (settings.developer) {
      logger.updateSettings(settings.developer);
    }
  }, [settings.developer]);

  const processTranslation = async (item: TranslationItem) => {
    if (item.status === 'translating' || item.status === 'success') return;

    const currentSettings = useStore.getState().settings;
    const limiter = limiterRef.current;
    
    if (!limiter) return;

    item.status = 'translating';
    logger.dom('Processing item:', item.id, item.element);
    
    if (currentSettings.showLoadingIcon) {
        // Apply "..." suffix to all parts to indicate loading
        item.parts.forEach(part => {
           if (part.status === 'pending') {
               part.node.textContent = part.originalText + '...';
           }
        });
        logger.dom('Applied loading suffix for item:', item.id);
    }

    const loadingStart = Date.now();

    try {
      // Process all parts that need translation
      const pendingParts = item.parts.filter(p => p.status === 'pending' || p.status === 'error');
      
      if (pendingParts.length === 0) {
        item.status = 'success';
        return;
      }

      await limiter(async () => {
        const targetLanguage = currentSettings.defaultToLang;
        const sourceLanguage = currentSettings.defaultFromLang;
        
        // Translate each part individually to preserve DOM placement
        // Use Promise.all to run them concurrently (up to limiter's capacity if we wrapped inside)
        // But here we are INSIDE the limiter. So we shouldn't block for too long.
        // Actually, we should probably schedule each part as a separate task in the limiter?
        // But `processTranslation` is called once per item.
        
        // Let's iterate and translate.
        for (const part of pendingParts) {
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
                 const networkStart = Date.now();
                 const response = await chrome.runtime.sendMessage(request) as TranslationResponse;
                 const networkDuration = Date.now() - networkStart;
                 
                 logger.network(`Part request took ${networkDuration}ms`, response.success ? 'Success' : 'Failed');
    
                 if (response.success && response.data) {
                    part.translatedText = response.data.translatedText;
                    part.status = 'success';
                    
                    // Update DOM immediately
                    logger.dom('Updating text node:', part.node);
                    part.node.textContent = response.data.translatedText;
                 } else {
                    part.status = 'error';
                    logger.translation('Part failed:', response.error);
                 }
             } catch (err) {
                 part.status = 'error';
                 console.error(err);
             }
        }
        
        // Check if all parts success
        const allSuccess = item.parts.every(p => p.status === 'success');
        const anyError = item.parts.some(p => p.status === 'error');
        
        if (allSuccess) {
           item.status = 'success';
           item.element.setAttribute('data-translated', 'true');
           item.element.setAttribute('data-translated-lang', targetLanguage);
           // We can't set title easily for multiple parts, maybe just set "Translated"
           item.element.setAttribute('title', 'Translated');
        } else if (anyError) {
           throw new Error('Some parts failed to translate');
        }
      });
    } catch (error) {
      console.error('Translation error:', error);
      item.retryCount++;
      if (item.retryCount < MAX_RETRIES) {
        item.status = 'pending'; // Reset to pending to retry
        logger.info(`Retrying translation for item ${item.id} (Attempt ${item.retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => processTranslation(item), 1000 * item.retryCount);
      } else {
        item.status = 'error';
        // Reset text content on error
        item.parts.forEach(part => {
             part.node.textContent = part.originalText;
        });
        logger.info(`Translation failed permanently for item ${item.id}`);
      }
    } finally {
       // No cleanup needed for text suffix
    }
  };

  const handleTranslate = async () => {
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
    const groups = getAllTranslatableGroups();
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

    // 2. Setup IntersectionObserver
    // Root margin 200px to pre-load content just outside viewport
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const item = itemsMap.get(entry.target as HTMLElement);
        if (!item) return;

        if (entry.isIntersecting) {
            item.isVisible = true;
            // If pending, trigger translation
            if (item.status === 'pending') {
                processTranslation(item);
            }
        } else {
            item.isVisible = false;
        }
      });
    }, {
        rootMargin: '200px',
        threshold: 0.1
    });

    observerRef.current = observer;

    // 3. Start observing
    itemsMap.forEach((item) => {
        observer.observe(item.element);
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
  };

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

  return (
    <div 
      className="fixed top-1/2 right-0 -translate-y-1/2 flex flex-col items-end gap-2 font-sans text-gray-900 z-[9999]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Quick Settings Menu */}
      {showMenu && (
        <div className="absolute top-0 right-10 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 animate-in slide-in-from-right-2 z-50 text-left">
           <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-gray-800 dark:text-white">Quick Settings</h3>
             <button onClick={() => setShowMenu(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
               <X className="w-4 h-4" />
             </button>
           </div>
           
           <div className="space-y-4">
              <div>
                 <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target Language</label>
                 <select 
                   className="w-full border border-gray-200 dark:border-gray-600 rounded-md p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                   value={settings.defaultToLang}
                   onChange={(e) => updateSettings({ defaultToLang: e.target.value })}
                 >
                   {supportedLanguages.map(lang => (
                     <option key={lang.code} value={lang.code}>{lang.name}</option>
                   ))}
                 </select>
              </div>

              <div>
                 <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Model</label>
                 <select 
                   className="w-full border border-gray-200 dark:border-gray-600 rounded-md p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
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
                className="w-full py-2 text-sm text-primary hover:bg-primary/5 dark:hover:bg-primary/20 rounded-md transition-colors font-medium" 
                onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })}
              >
                 More Settings
              </button>
              
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                   <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
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
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
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
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
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
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
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
        "transition-all duration-300 ease-in-out transform origin-right mb-1 mr-1",
        isHovered || showMenu ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-10 scale-0 pointer-events-none"
      )}>
         <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border border-gray-100 dark:border-gray-600"
            title="Settings"
         >
           <Settings className="w-4 h-4" />
         </button>
      </div>

      {/* Main FAB */}
      <button
        onClick={handleTranslate}
        disabled={isTranslating}
        className={cn(
          "w-8 h-8 rounded-l-lg shadow-xl flex items-center justify-center transition-all duration-300 z-50",
          "bg-primary text-white hover:bg-primary-dark hover:w-10 active:scale-95",
          "dark:bg-primary-dark dark:text-gray-100",
          isTranslating && "cursor-wait opacity-80"
        )}
      >
        {isTranslating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Languages className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};

export default ContentApp;
