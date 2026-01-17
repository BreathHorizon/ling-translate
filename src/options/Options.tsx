import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ApiConfig } from './components/ApiConfig';
import { ModelConfig } from './components/ModelConfig';
import { ThemeConfig } from './components/ThemeConfig';
import { About } from './components/About';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/Button';
import { Download, Upload, Terminal, AlertTriangle } from 'lucide-react';

const Options: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const { loadSettings, isLoading, settings, updateSettings, resetSettings } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                <h2 className="text-2xl font-bold mb-4">General Settings</h2>
                <p className="text-gray-500">
                  Welcome to Ling Translate! Please configure your API and Models to get started.
                </p>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold mb-4">Translation</h2>
                <label className="flex items-center gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={settings.showLoadingIcon ?? true}
                    onChange={(e) => updateSettings({ showLoadingIcon: e.target.checked })}
                  />
                  Show a loading icon beside text while translating
                </label>
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
                   Developer Settings
                 </h2>
                 <p className="text-gray-500 mb-6">
                   Advanced options for debugging and development.
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
                      Enable Developer Mode
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
                          Log DOM Operations
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
                          Log Translation Content
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
                          Log Network Requests
                       </label>
                     </div>
                   )}
                 </div>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-red-200 bg-red-50/30">
                <h2 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </h2>
                <p className="text-gray-600 mb-6">
                  Actions here can cause data loss and cannot be undone.
                </p>
                <Button 
                  onClick={handleResetSettings} 
                  variant="outline" 
                  className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                >
                  Clear All Settings
                </Button>
              </div>
            </div>
          )}
          {activeTab === 'theme' && <ThemeConfig />}
          {activeTab === 'apis' && <ApiConfig />}
          {activeTab === 'models' && <ModelConfig />}
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
