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

const Options: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const { loadSettings, isLoading, settings, updateSettings, resetSettings } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingStyleLabels: Record<string, string> = {
    spinner: '旋转',
    ellipsis: '省略号',
    both: '旋转 + 省略号',
    none: '无',
  };

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
                alert('设置导入成功！');
            } else {
                alert('设置文件无效。');
            }
          } catch (error) {
            console.error('Error parsing settings file:', error);
            alert('解析设置文件出错。');
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
    if (confirm('确定要清除所有设置吗？此操作无法撤销，将恢复为默认值。')) {
        await resetSettings();
        alert('所有设置已恢复为默认值。');
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
                <h2 className="text-2xl font-bold mb-4">常规设置</h2>
                <p className="text-gray-500">
                  欢迎使用 Ling Translate！请先配置 API 和模型以开始使用。
                </p>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold mb-4">加载指示器样式</h2>
                <p className="text-gray-500 mb-4">
                  选择翻译时文本旁的加载指示器显示方式。
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
                      <span className="text-sm text-gray-700 font-medium">{loadingStyleLabels[style] || style}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Visibility Settings */}
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold mb-4">按钮可见性</h2>
                <div className="space-y-6">
                   <label className="flex items-center gap-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={!settings.hideGlobalButton}
                        onChange={(e) => updateSettings({ hideGlobalButton: !e.target.checked })}
                      />
                      显示悬浮翻译按钮
                   </label>
                   
                   <div>
                     <h3 className="text-sm font-medium text-gray-700 mb-2">隐藏的网站</h3>
                     <p className="text-xs text-gray-500 mb-3">悬浮按钮会在这些网站上隐藏。</p>
                     
                     {(!settings.hideDomains || settings.hideDomains.length === 0) ? (
                        <p className="text-sm text-gray-400 italic">暂无隐藏网站。</p>
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
                                  title="移除"
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
                   键盘快捷键
                </h2>
                <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                         切换翻译
                      </label>
                      <div className="flex gap-2">
                         <input
                           type="text"
                           readOnly
                           value={settings.shortcuts?.translate || 'Alt+A'}
                           className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary text-sm bg-gray-50 cursor-pointer"
                           placeholder="点击并录入快捷键..."
                           onClick={(e) => {
                               const input = e.currentTarget;
                               input.value = '请按下按键...';
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
                                       alert(`快捷键“${finalShortcut}”可能是系统保留键，请换一个。`);
                                       // Reset to old
                                       input.value = settings.shortcuts?.translate || 'Alt+A';
                                   } else if (finalShortcut && finalShortcut !== '请按下按键...') {
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
                           重置
                         </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        点击输入框并按下所需组合键。默认是 Alt+A。
                      </p>
                   </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold mb-4">配置管理</h2>
                <p className="text-gray-500 mb-6">
                  导出设置到文件或从备份导入。
                </p>
                <div className="flex gap-4">
                  <Button onClick={handleExport} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    导出设置
                  </Button>
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    导入设置
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
                   开发者设置
                 </h2>
                 <p className="text-gray-500 mb-6">
                   用于调试和开发的高级选项。
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
                      启用开发者模式
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
                          记录 DOM 操作
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
                          记录翻译内容
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
                          记录网络请求
                       </label>
                     </div>
                   )}
                 </div>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-red-200 bg-red-50/30">
                <h2 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  危险区域
                </h2>
                <p className="text-gray-600 mb-6">
                  此处的操作会导致数据丢失且无法撤销。
                </p>
                <Button 
                  onClick={handleResetSettings} 
                  variant="outline" 
                  className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                >
                  清除所有设置
                </Button>
              </div>
            </div>
          )}
          {activeTab === 'theme' && <ThemeConfig />}
          {activeTab === 'models' && <ModelConfig />}
          {activeTab === 'auto_translate' && <AutoTranslateConfig />}
           {activeTab === 'prompts' && (
             <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold mb-4">提示词配置</h2>
              <p className="text-gray-500">高级提示词设置目前在模型配置中管理。</p>
            </div>
          )}
          {activeTab === 'about' && <About />}
        </div>
      </main>
    </div>
  );
};

export default Options;
