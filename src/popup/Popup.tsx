import React, { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Settings, ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const Popup: React.FC = () => {
  const { settings, loadSettings, updateSettings } = useStore();
  
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const supportedLanguages = [
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'es', name: 'Spanish' },
  ];

  const availableModels = settings.apiConfigs.flatMap(api => 
    api.models.map(model => ({
      id: `${api.id}:${model.id}`,
      name: `${model.name} (${api.name})`
    }))
  );

  return (
    <div className="w-80 bg-white dark:bg-gray-800 min-h-[350px] flex flex-col">
      <div className="p-4 border-b bg-primary text-white flex justify-between items-center">
        <h1 className="font-bold flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Chrome Translator
        </h1>
        <button 
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-white/80 hover:text-white transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
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

        {availableModels.length === 0 && (
          <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
            Please configure an API and Model in settings first.
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
        <Button className="w-full" onClick={() => chrome.runtime.openOptionsPage()}>
          <ExternalLink className="w-4 h-4 mr-2" />
          Full Settings
        </Button>
      </div>
    </div>
  );
};

export default Popup;
