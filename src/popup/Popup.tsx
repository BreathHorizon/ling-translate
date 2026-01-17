import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Settings, ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const Popup: React.FC = () => {
  const { settings, loadSettings, updateSettings } = useStore();
  const [activeHostname, setActiveHostname] = useState<string | null>(null);
  
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const url = tab?.url;
      if (!url) {
        setActiveHostname(null);
        return;
      }
      try {
        const hostname = new URL(url).hostname;
        setActiveHostname(hostname || null);
      } catch {
        setActiveHostname(null);
      }
    });
  }, []);

  const supportedLanguages = [
    { code: 'zh-CN', name: '中文（简体）' },
    { code: 'en', name: '英语' },
    { code: 'ja', name: '日语' },
    { code: 'ko', name: '韩语' },
    { code: 'fr', name: '法语' },
    { code: 'de', name: '德语' },
    { code: 'es', name: '西班牙语' },
  ];

  const availableModels = useMemo(() => {
    return settings.apiConfigs.flatMap((api) =>
      api.models.map((model) => ({
        id: `${api.id}:${model.id}`,
        name: `${model.name} (${api.name})`,
      }))
    );
  }, [settings.apiConfigs]);

  const isAutoTranslateEnabled = useMemo(() => {
    if (!activeHostname) return false;
    return (settings.autoTranslateDomains || []).includes(activeHostname);
  }, [activeHostname, settings.autoTranslateDomains]);

  const toggleAutoTranslate = () => {
    if (!activeHostname) return;
    const currentDomains = settings.autoTranslateDomains || [];
    const nextDomains = currentDomains.includes(activeHostname)
      ? currentDomains.filter((d) => d !== activeHostname)
      : [...currentDomains, activeHostname];
    updateSettings({ autoTranslateDomains: nextDomains });
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 min-h-[350px] flex flex-col">
      <div className="p-4 border-b bg-primary text-white flex justify-between items-center">
        <h1 className="font-bold flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Ling 翻译
        </h1>
        <button 
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-white/80 hover:text-white transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer p-2 rounded-lg transition-colors bg-gray-50 dark:bg-gray-700/40">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
            checked={isAutoTranslateEnabled}
            onChange={toggleAutoTranslate}
            disabled={!activeHostname}
          />
          <div className="flex-1">
            <div className="text-gray-800 dark:text-gray-100">自动翻译此网站</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {activeHostname ? activeHostname : '当前页面不支持'}
            </div>
          </div>
        </label>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">目标语言</label>
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
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">模型</label>
          <select 
            className="w-full border border-gray-200 dark:border-gray-600 rounded-md p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
            value={settings.defaultModelId}
            onChange={(e) => updateSettings({ defaultModelId: e.target.value })}
          >
            <option value="">选择模型...</option>
            {availableModels.map(model => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
        </div>

        {availableModels.length === 0 && (
          <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
            请先在设置中配置 API 和模型。
          </div>
        )}

        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between py-2">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">开发者模式</div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.developer?.enabled ?? false}
                onChange={(e) =>
                  updateSettings({
                    developer: { ...settings.developer, enabled: e.target.checked },
                  })
                }
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
            </label>
          </div>

          {settings.developer?.enabled && (
            <div className="space-y-2 pb-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                  checked={settings.developer?.logDom ?? false}
                  onChange={(e) =>
                    updateSettings({
                      developer: { ...settings.developer, logDom: e.target.checked },
                    })
                  }
                />
                记录 DOM 操作
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                  checked={settings.developer?.logTranslation ?? false}
                  onChange={(e) =>
                    updateSettings({
                      developer: { ...settings.developer, logTranslation: e.target.checked },
                    })
                  }
                />
                记录翻译内容
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                  checked={settings.developer?.logNetwork ?? false}
                  onChange={(e) =>
                    updateSettings({
                      developer: { ...settings.developer, logNetwork: e.target.checked },
                    })
                  }
                />
                记录网络请求
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
        <Button className="w-full" onClick={() => chrome.runtime.openOptionsPage()}>
          <ExternalLink className="w-4 h-4 mr-2" />
          完整设置
        </Button>
      </div>
    </div>
  );
};

export default Popup;
