import React, { useState, useEffect } from 'react';
import { Languages, Settings, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TranslationRequest, TranslationResponse } from '@/lib/types';
import { useStore } from '@/store/useStore';

const TARGET_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, dt, dd, figcaption';
const MIN_LOADING_MS = 200;

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

        // Visibility check
        if (parent.checkVisibility) {
            if (!parent.checkVisibility()) return NodeFilter.FILTER_REJECT;
        } else {
            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const groups = new Map<HTMLElement, Text[]>();
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (parent) {
      if (!groups.has(parent)) {
        groups.set(parent, []);
      }
      groups.get(parent)?.push(node);
    }
  }
  return groups;
};

const attachLoadingBadge = (element: HTMLElement) => {
  if (element.querySelector('[data-translate-loading="true"]')) return null;

  const badge = document.createElement('span');
  badge.setAttribute('data-translate-loading', 'true');
  badge.setAttribute('aria-hidden', 'true');
  badge.style.display = 'inline-block';
  badge.style.width = '0.8em';
  badge.style.height = '0.8em';
  badge.style.marginLeft = '0.35em';
  badge.style.border = '2px solid currentColor';
  badge.style.borderTopColor = 'transparent';
  badge.style.borderRadius = '999px';
  badge.style.verticalAlign = 'middle';
  badge.style.boxSizing = 'border-box';
  badge.style.opacity = '0.75';
  badge.style.animation = 'ling-translate-spin 0.8s linear infinite';

  const styleId = 'ling-translate-loading-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '@keyframes ling-translate-spin { to { transform: rotate(360deg); } }';
    (document.head || document.documentElement).appendChild(style);
  }

  element.appendChild(badge);
  return badge;
};

// Promise-based limiter to respect both concurrency and rate limits
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

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleTranslate = async () => {
    if (isTranslating) return;
    
    // Refresh settings to ensure latest
    await loadSettings();
    const currentSettings = useStore.getState().settings;

    if (!currentSettings.defaultModelId) {
      if (confirm('No translation model selected. Would you like to configure one now?')) {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
      }
      return;
    }

    setIsTranslating(true);
    
    try {
      const targetLanguage = currentSettings.defaultToLang;
      const sourceLanguage = currentSettings.defaultFromLang;
      const [apiId, modelId] = currentSettings.defaultModelId.split(':');
      const modelConfig = currentSettings.apiConfigs
        .find(api => api.id === apiId)
        ?.models.find(model => model.id === modelId);

      const maxParagraphs = Math.max(1, modelConfig?.maxParagraphs ?? 50);
      // Ignore maxParagraphs limit for whole page translation as per user request
      // const maxParagraphs = Math.max(1, modelConfig?.maxParagraphs ?? 5); 
      const concurrency = Math.max(1, modelConfig?.concurrency ?? 4);
      const requestsPerSecond = Math.max(
        1,
        modelConfig?.requestsPerSecond ?? modelConfig?.concurrency ?? 12
      );
      const limit = createRequestLimiter(concurrency, requestsPerSecond);
      const showLoadingIcon = currentSettings.showLoadingIcon ?? true;
      
      const paragraphs = Array.from(document.querySelectorAll(TARGET_SELECTOR))
        .filter((el): el is HTMLElement => el instanceof HTMLElement);
      
      const visibleParagraphs = paragraphs.filter(p => {
        const rect = p.getBoundingClientRect();
        const hasText = p.textContent?.trim();
        const translatedLang = p.getAttribute('data-translated-lang');
        // Check if element is at least partially visible in viewport
        const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
        return isVisible && Boolean(hasText) && translatedLang !== targetLanguage;
      });

      // Filter out nested elements to prevent double translation
      const distinctParagraphs = visibleParagraphs.filter(p => {
        return !visibleParagraphs.some(other => other !== p && other.contains(p));
      });

      const elementsToTranslate = distinctParagraphs.slice(0, maxParagraphs);
      const groups = getAllTranslatableGroups();
      const elementsToTranslate = Array.from(groups.entries());

      const translationTasks = elementsToTranslate.map(async ([element, textNodes]) => {
        if (textNodes.length === 0) return;

        const originalText = textNodes
          .map(node => node.textContent?.trim() || '')
          .filter(Boolean)
          .join('\n');

        let hasTranslated = false;
        const loadingBadge = showLoadingIcon ? attachLoadingBadge(element) : null;
        const loadingStart = loadingBadge ? Date.now() : 0;

        const nodeTasks = textNodes.map((node) => {
          const text = node.textContent || '';
          const trimmed = text.trim();
          if (!trimmed) return null;

          const leadingWhitespace = text.match(/^\s*/)?.[0] ?? '';
          const trailingWhitespace = text.match(/\s*$/)?.[0] ?? '';

          return limit(async () => {
            try {
              const request: TranslationRequest = {
                type: 'TRANSLATE_TEXT',
                payload: {
                  text: trimmed,
                  from: sourceLanguage,
                  to: targetLanguage,
                  contentType: 'text',
                  modelId: currentSettings.defaultModelId
                }
              };
  
              const response = await chrome.runtime.sendMessage(request) as TranslationResponse;
              
              if (response.success && response.data) {
                node.textContent = `${leadingWhitespace}${response.data.translatedText}${trailingWhitespace}`;
                hasTranslated = true;
              } else {
                console.error('Translation failed for:', trimmed, response.error);
              }
            } catch (err) {
              console.error('Translation request error for:', trimmed, err);
            }
          });
        }).filter(Boolean) as Promise<void>[];

        await Promise.all(nodeTasks);

        if (loadingBadge) {
          const elapsed = Date.now() - loadingStart;
          if (elapsed < MIN_LOADING_MS) {
            await new Promise(resolve => setTimeout(resolve, MIN_LOADING_MS - elapsed));
          }
          loadingBadge.remove();
        }

        if (originalText && hasTranslated) {
          element.setAttribute('title', originalText);
        }
        if (hasTranslated) {
          element.setAttribute('data-translated', 'true');
          element.setAttribute('data-translated-lang', targetLanguage);
        }
      });

      await Promise.all(translationTasks);

    } catch (error) {
      console.error('Translation process error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const supportedLanguages = [
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'es', name: 'Spanish' },
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
          !isHovered && !showMenu && "opacity-50 hover:opacity-100 translate-x-2 hover:translate-x-0", // Semi-hide when idle
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
