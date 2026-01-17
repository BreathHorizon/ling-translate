import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Upload, Trash2, Palette, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const ThemeConfig: React.FC = () => {
  const { settings, updateSettings } = useStore();
  const floatingInputRef = useRef<HTMLInputElement>(null);
  const settingsInputRef = useRef<HTMLInputElement>(null);
  const loadingStyleLabels: Record<string, string> = {
    spinner: '旋转',
    ellipsis: '省略号',
    both: '旋转 + 省略号',
    none: '无',
  };
  const toneLabels: Record<string, string> = {
    light: '浅色',
    dark: '深色',
  };
  const maskTypeLabels: Record<string, string> = {
    auto: '自动',
    light: '浅色',
    dark: '深色',
  };

  const [localTheme, setLocalTheme] = useState({
    mode: 'frosted' as const,
    frostedTone: 'dark' as const,
    frostedOpacity: 0.72,
    syncFloatingWallpaperToSettingsButton: false,
    maskType: 'auto' as const,
    maskOpacity: 0.8,
    loadingStyle: 'both' as const,
    ...settings.theme,
  });

  useEffect(() => {
    setLocalTheme(prev => ({ 
        ...prev, 
        ...settings.theme,
        loadingStyle: (settings.loadingStyle ?? prev.loadingStyle) as typeof prev.loadingStyle
    }));
  }, [settings.theme, settings.loadingStyle]);

  const updateLocalTheme = (partial: Partial<typeof localTheme>) => {
    setLocalTheme(prev => ({ ...prev, ...partial }));
  };

  const handleSave = () => {
    updateSettings({
      theme: {
          mode: localTheme.mode,
          frostedTone: localTheme.frostedTone,
          frostedOpacity: localTheme.frostedOpacity,
          syncFloatingWallpaperToSettingsButton: localTheme.syncFloatingWallpaperToSettingsButton,
          maskType: localTheme.maskType,
          maskOpacity: localTheme.maskOpacity,
          floatingWallpaper: localTheme.floatingWallpaper,
          settingsWallpaper: localTheme.settingsWallpaper
      },
      loadingStyle: localTheme.loadingStyle,
    });
    alert('主题设置已保存！');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'floating' | 'settings') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('图片过大，请选择 2MB 以内的图片。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      updateLocalTheme({
        mode: 'wallpaper',
        [type === 'floating' ? 'floatingWallpaper' : 'settingsWallpaper']: base64,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearWallpaper = (type: 'floating' | 'settings') => {
    updateLocalTheme({
      [type === 'floating' ? 'floatingWallpaper' : 'settingsWallpaper']: undefined,
    });
  };

  return (
    <div className="space-y-6">
       <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
           <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-bold flex items-center gap-2">
                   <Palette className="w-5 h-5 text-primary" />
                   外观与主题
               </h2>
               <Button onClick={handleSave} className="flex items-center gap-2">
                   <Save className="w-4 h-4" />
                   保存
               </Button>
           </div>

           <div className="mb-8 space-y-4">
            <h3 className="font-semibold text-gray-700">加载指示器样式</h3>
            <div className="flex flex-wrap gap-4">
              {(['spinner', 'ellipsis', 'both', 'none'] as const).map((style) => (
                <label key={style} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="loadingStyle"
                    value={style}
                    checked={localTheme.loadingStyle === style}
                    onChange={() => updateLocalTheme({ loadingStyle: style as typeof localTheme.loadingStyle })}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">{loadingStyleLabels[style] || style}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-8 space-y-4">
             <h3 className="font-semibold text-gray-700">主题模式</h3>
             <div className="flex flex-wrap gap-4">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="radio"
                   name="themeMode"
                   value="frosted"
                   checked={localTheme.mode === 'frosted'}
                   onChange={() => updateLocalTheme({ mode: 'frosted' })}
                   className="text-primary focus:ring-primary"
                 />
                 <span className="text-sm text-gray-700">磨砂玻璃</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="radio"
                   name="themeMode"
                   value="wallpaper"
                   checked={localTheme.mode === 'wallpaper'}
                   onChange={() => updateLocalTheme({ mode: 'wallpaper' })}
                   className="text-primary focus:ring-primary"
                 />
                 <span className="text-sm text-gray-700">自定义壁纸</span>
               </label>
             </div>
           </div>

           {localTheme.mode === 'frosted' ? (
             <div className="space-y-6">
               <div className="space-y-4">
                 <h3 className="font-semibold text-gray-700">磨砂玻璃色调</h3>
                 <div className="flex gap-4">
                   {(['light', 'dark'] as const).map((tone) => (
                     <label key={tone} className="flex items-center gap-2 cursor-pointer">
                       <input
                         type="radio"
                         name="frostedTone"
                         value={tone}
                         checked={localTheme.frostedTone === tone}
                         onChange={() => updateLocalTheme({ frostedTone: tone })}
                         className="text-primary focus:ring-primary"
                       />
                       <span className="text-sm text-gray-700">{toneLabels[tone] || tone}</span>
                     </label>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   磨砂透明度：{Math.round(localTheme.frostedOpacity * 100)}%
                 </label>
                 <input
                   type="range"
                   min="0.2"
                   max="1"
                   step="0.02"
                   value={localTheme.frostedOpacity}
                   onChange={(e) => updateLocalTheme({ frostedOpacity: parseFloat(e.target.value) })}
                   className="w-full max-w-xs accent-primary"
                 />
               </div>
             </div>
           ) : (
             <div className="space-y-8">
               <div className="space-y-4">
                 <h3 className="font-semibold text-gray-700">壁纸遮罩</h3>
                 <div className="flex gap-4">
                   {(['auto', 'light', 'dark'] as const).map((type) => (
                     <label key={type} className="flex items-center gap-2 cursor-pointer">
                       <input
                         type="radio"
                         name="maskType"
                         value={type}
                         checked={localTheme.maskType === type}
                         onChange={() => updateLocalTheme({ maskType: type })}
                         className="text-primary focus:ring-primary"
                       />
                       <span className="text-sm text-gray-700">{maskTypeLabels[type] || type}</span>
                     </label>
                   ))}
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     遮罩不透明度：{Math.round(localTheme.maskOpacity * 100)}%
                   </label>
                   <input
                     type="range"
                     min="0"
                     max="1"
                     step="0.02"
                     value={localTheme.maskOpacity}
                     onChange={(e) => updateLocalTheme({ maskOpacity: parseFloat(e.target.value) })}
                     className="w-full max-w-xs accent-primary"
                   />
                 </div>

                 <label className="flex items-center gap-3 text-sm text-gray-700">
                   <input
                     type="checkbox"
                   className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                   checked={localTheme.syncFloatingWallpaperToSettingsButton ?? false}
                   onChange={(e) => updateLocalTheme({ syncFloatingWallpaperToSettingsButton: e.target.checked })}
                 />
                   将悬浮壁纸同步到设置按钮
                 </label>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                   <h3 className="font-semibold text-gray-700 mb-3">悬浮按钮壁纸</h3>
                   <div className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors group">
                     {localTheme.floatingWallpaper ? (
                       <>
                         <img src={localTheme.floatingWallpaper} alt="悬浮壁纸" className="w-full h-full object-cover" />
                         <button
                           onClick={() => clearWallpaper('floating')}
                           className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                         >
                           <Trash2 className="w-6 h-6" />
                         </button>
                       </>
                     ) : (
                       <button onClick={() => floatingInputRef.current?.click()} className="flex flex-col items-center text-gray-400">
                         <Upload className="w-6 h-6 mb-1" />
                         <span className="text-xs">上传</span>
                       </button>
                     )}
                   </div>
                   <input
                     type="file"
                     ref={floatingInputRef}
                     className="hidden"
                     accept="image/*"
                     onChange={(e) => handleImageUpload(e, 'floating')}
                   />
                 </div>

                 <div>
                   <h3 className="font-semibold text-gray-700 mb-3">设置面板壁纸</h3>
                   <div className="relative w-full max-w-xs h-40 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors group">
                     {localTheme.settingsWallpaper ? (
                       <>
                         <img src={localTheme.settingsWallpaper} alt="设置面板壁纸" className="w-full h-full object-cover" />
                         <button
                           onClick={() => clearWallpaper('settings')}
                           className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                         >
                           <Trash2 className="w-6 h-6" />
                         </button>
                       </>
                     ) : (
                       <button onClick={() => settingsInputRef.current?.click()} className="flex flex-col items-center text-gray-400">
                         <Upload className="w-8 h-8 mb-1" />
                         <span className="text-xs">上传</span>
                       </button>
                     )}
                   </div>
                   <input
                     type="file"
                     ref={settingsInputRef}
                     className="hidden"
                     accept="image/*"
                     onChange={(e) => handleImageUpload(e, 'settings')}
                   />
                 </div>
               </div>
             </div>
           )}
       </div>

    </div>
  );
};
