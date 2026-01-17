import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ModelConfig } from './components/ModelConfig';
import { ThemeConfig } from './components/ThemeConfig';
import { AutoTranslateConfig } from './components/AutoTranslateConfig';
import { About } from './components/About';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/Button';
import { normalizeKey, sortKeys } from '@/lib/utils';
import { Download, Upload, Terminal, AlertTriangle, Trash2, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguageSync } from '@/hooks/useLanguageSync';

const Options: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const { loadSettings, isLoading, settings, updateSettings, resetSettings } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  useLanguageSync();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `ling-translate-settings-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files.length > 0) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = async (e) => {
        if (e.target?.result) {
          try {
            const importedSettings = JSON.parse(e.target.result as string);
            if (importedSettings && typeof importedSettings === 'object') {
                await updateSettings(importedSettings);
                alert('Settings imported successfully!');
            } else {
                alert('Invalid settings file.');
            }
          } catch (error) {
            console.error('Error parsing settings file:', error);
            alert('Error parsing settings file.');
          }
        }
        // Reset the input so the same file can be selected again if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
    }
  };

  const handleResetSettings = async () => {
    if (confirm('Are you sure you want to clear all settings? This action cannot be undone and will reset everything to default.')) {
        await resetSettings();
        alert('All settings have been reset to default.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
        <div className="max-w-4xl mx-auto pb-12">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h2 className="text-2xl font-bold mb-4">{t('settings.general.title')}</h2>
                <p className="text-gray-500">
                  {t('settings.general.description')}
                </p>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold mb-4">{t('settings.general.interface_language')}</h2>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: 'auto', label: 'Auto' },
                    { value: 'en', label: 'English' },
                    { value: 'zh-CN', label: '简体中文' },
                  ].map((lang) => (
                    <label key={lang.value} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                      <input
                        type="radio"
                        name="interfaceLanguage"
                        value={lang.value}
                        checked={(settings as any).interfaceLanguage === lang.value}
                        onChange={() => updateSettings({ ...(settings as any), interfaceLanguage: lang.value })}
                        className="text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className="text-sm text-gray-700 font-medium">{lang.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                  <h2 className="text-xl font-bold mb-4">{t('settings.general.loading_style.title')}</h2>
                  <p className="text-gray-500 mb-4">
                    {t('settings.general.loading_style.description')}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {(['spinner', 'ellipsis', 'both', 'none'] as const).map((style) => (
                      <label key={style} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                        <input
                          type="radio"
                          name="loadingStyleGeneral"
                          value={style}
                          checked={settings.loadingStyle === style}
                          onChange={() => updateSettings({ loadingStyle: style })}
                          className="text-primary focus:ring-primary w-4 h-4"
                        />
                        <span className="capitalize text-sm text-gray-700 font-medium">{t(`settings.general.loading_style.${style}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>

              {/* Visibility Settings */}
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold mb-4">{t('settings.general.visibility.title')}</h2>
                <div className="space-y-6">
                   <label className="flex items-center gap-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={!settings.hideGlobalButton}
                        onChange={(e) => updateSettings({ hideGlobalButton: !e.target.checked })}
                      />
                      {t('settings.general.visibility.show_floating_button')}
                   </label>
                   
                   <div>
                     <h3 className="text-sm font-medium text-gray-700 mb-2">{t('settings.general.visibility.hidden_websites')}</h3>
                     <p className="text-xs text-gray-500 mb-3">{t('settings.general.visibility.hidden_websites_desc')}</p>
                     
                     {(!settings.hideDomains || settings.hideDomains.length === 0) ? (
                        <p className="text-sm text-gray-400 italic">{t('settings.general.visibility.no_hidden_websites')}</p>
                     ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                           {settings.hideDomains.map((domain) => (
                             <div key={domain} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-100">
                                <span className="text-sm text-gray-600">{domain}</span>
                                <button 
                                  onClick={() => updateSettings({ 
                                    hideDomains: settings.hideDomains?.filter(d => d !== domain) 
                                  })}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="Remove"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                           ))}
                        </div>
                     )}
                   </div>
                </div>
              </div>

              {/* Shortcut Settings */}
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                   <Keyboard className="w-5 h-5 text-gray-700" />
                   Keyboard Shortcuts
                </h2>
                <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                         Toggle Translation
                      </label>
                      <div className="flex gap-2">
                         <input
                           type="text"
                           readOnly
                           value={settings.shortcuts?.translate || 'Alt+A'}
                           className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary text-sm bg-gray-50 cursor-pointer"
                           placeholder="Click to record shortcut..."
                           onClick={(e) => {
                               const input = e.currentTarget;
                               input.value = 'Press keys...';
                               input.classList.add('animate-pulse', 'border-primary');
                               
                               const pressedKeys = new Set<string>();

                               const handleKeyDown = (ev: KeyboardEvent) => {
                                   ev.preventDefault();
                                   ev.stopPropagation();
                                   
                                   const normalized = normalizeKey(ev.key);
                                   pressedKeys.add(normalized);
                                   
                                   const keys = sortKeys(Array.from(pressedKeys));
                                   input.value = keys.join('+');
                               };
                               
                               const handleKeyUp = (ev: KeyboardEvent) => {
                                   ev.preventDefault();
                                   ev.stopPropagation();
                                   
                                   const normalized = normalizeKey(ev.key);
                                   pressedKeys.delete(normalized);
                                   
                                   // If no keys left, we are done? Or do we keep recording?
                                   // Actually, usually we commit on keyup if no keys are pressed?
                                   // But we might want to capture "Ctrl+A" where A is released first.
                                   // So we update the SETTING only on keydown (peak), or wait for user to finish?
                                   // Let's stick to "live update input on keydown", and "commit on blur or stop".
                                   // But the previous implementation used `once: true`.
                                   // To support multi-key, we need a way to stop.
                                   // Standard: Click away to stop recording.
                               };

                               // We need to commit the value when the user clicks away (blur)
                               const handleBlur = () => {
                                   const finalShortcut = input.value;
                                   
                                   // Simple conflict check
                                   const reserved = ['Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+A', 'Ctrl+S', 'Ctrl+P'];
                                   if (reserved.includes(finalShortcut)) {
                                       alert(`Shortcut "${finalShortcut}" is likely a system reserved key. Please choose another.`);
                                       // Reset to old
                                       input.value = settings.shortcuts?.translate || 'Alt+A';
                                   } else if (finalShortcut && finalShortcut !== 'Press keys...') {
                                       updateSettings({ 
                                           shortcuts: { ...settings.shortcuts, translate: finalShortcut } 
                                       });
                                   } else {
                                        input.value = settings.shortcuts?.translate || 'Alt+A';
                                   }

                                   input.classList.remove('animate-pulse', 'border-primary');
                                   document.removeEventListener('keydown', handleKeyDown);
                                   document.removeEventListener('keyup', handleKeyUp);
                                   input.removeEventListener('blur', handleBlur);
                               };
                               
                               document.addEventListener('keydown', handleKeyDown);
                               document.addEventListener('keyup', handleKeyUp);
                               input.addEventListener('blur', handleBlur);
                           }}
                         />
                         <Button 
                             variant="outline"
                             onClick={() => updateSettings({ 
                                 shortcuts: { ...settings.shortcuts, translate: 'Alt+A' } 
                             })}
                           >
                             {t('settings.general.shortcuts.reset')}
                           </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {t('settings.general.shortcuts.instructions')}
                        </p>
                   </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold mb-4">Configuration Management</h2>
                <p className="text-gray-500 mb-6">
                  Export your settings to a file or import them from a backup.
                </p>
                <div className="flex gap-4">
                  <Button onClick={handleExport} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export Settings
                  </Button>
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Import Settings
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImport}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                 <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                   <Terminal className="w-5 h-5 text-gray-700" />
                   {t('settings.general.developer.title')}
                 </h2>
                 <p className="text-gray-500 mb-6">
                   {t('settings.general.developer.description')}
                 </p>
                 
                 <div className="space-y-4">
                   <label className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={settings.developer?.enabled ?? false}
                        onChange={(e) => updateSettings({ 
                          developer: { ...settings.developer, enabled: e.target.checked } 
                        })}
                      />
                      {t('settings.general.developer.enable')}
                   </label>

                   {(settings.developer?.enabled) && (
                     <div className="pl-7 space-y-3">
                       <label className="flex items-center gap-3 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={settings.developer?.logDom ?? false}
                            onChange={(e) => updateSettings({ 
                              developer: { ...settings.developer, logDom: e.target.checked } 
                            })}
                          />
                          {t('settings.general.developer.log_dom')}
                       </label>
                       <label className="flex items-center gap-3 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={settings.developer?.logTranslation ?? false}
                            onChange={(e) => updateSettings({ 
                              developer: { ...settings.developer, logTranslation: e.target.checked } 
                            })}
                          />
                          {t('settings.general.developer.log_translation')}
                       </label>
                       <label className="flex items-center gap-3 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={settings.developer?.logNetwork ?? false}
                            onChange={(e) => updateSettings({ 
                              developer: { ...settings.developer, logNetwork: e.target.checked } 
                            })}
                          />
                          {t('settings.general.developer.log_network')}
                       </label>
                     </div>
                   )}
                 </div>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-red-200 bg-red-50/30">
                <h2 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {t('settings.general.danger_zone.title')}
                </h2>
                <p className="text-gray-600 mb-6">
                  {t('settings.general.danger_zone.description')}
                </p>
                <Button 
                  onClick={handleResetSettings} 
                  variant="outline" 
                  className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                >
                  {t('settings.general.danger_zone.clear_all')}
                </Button>
              </div>
            </div>
          )}
          {activeTab === 'theme' && <ThemeConfig />}
          {activeTab === 'models' && <ModelConfig />}
          {activeTab === 'auto_translate' && <AutoTranslateConfig />}
           {activeTab === 'prompts' && (
             <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold mb-4">Prompt Configuration</h2>
              <p className="text-gray-500">Advanced prompt settings are currently managed within Model Configuration.</p>
            </div>
          )}
          {activeTab === 'about' && <About />}
        </div>
      </main>
    </div>
  );
};

export default Options;
