import React, { useRef } from 'react';
import { useStore } from '@/store/useStore';
import { Upload, X, Trash2, Globe, Palette } from 'lucide-react';

export const ThemeConfig: React.FC = () => {
  const { settings, updateSettings } = useStore();
  const floatingInputRef = useRef<HTMLInputElement>(null);
  const settingsInputRef = useRef<HTMLInputElement>(null);

  const theme = {
    mode: 'frosted' as const,
    frostedTone: 'dark' as const,
    frostedOpacity: 0.72,
    maskType: 'auto' as const,
    maskOpacity: 0.8,
    ...settings.theme,
  };

  const updateTheme = (partial: Partial<typeof theme>) => {
    updateSettings({
      theme: {
        ...theme,
        ...partial,
      },
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'floating' | 'settings') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image too large. Please select an image under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      updateTheme({
        mode: 'wallpaper',
        [type === 'floating' ? 'floatingWallpaper' : 'settingsWallpaper']: base64,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearWallpaper = (type: 'floating' | 'settings') => {
    updateTheme({
      [type === 'floating' ? 'floatingWallpaper' : 'settingsWallpaper']: undefined,
    });
  };

  const handleAutoTranslateRemove = (domain: string) => {
    const newDomains = settings.autoTranslateDomains?.filter(d => d !== domain) || [];
    updateSettings({ autoTranslateDomains: newDomains });
  };

  const handleAutoTranslateAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
     if (e.key === 'Enter') {
         const val = e.currentTarget.value.trim();
         if (val && !settings.autoTranslateDomains?.includes(val)) {
             updateSettings({
                 autoTranslateDomains: [...(settings.autoTranslateDomains || []), val]
             });
             e.currentTarget.value = '';
         }
     }
  };

  return (
    <div className="space-y-6">
       <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
           <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
               <Palette className="w-5 h-5 text-primary" />
               Appearance & Theme
           </h2>

           <div className="mb-8 space-y-4">
             <h3 className="font-semibold text-gray-700">Theme Mode</h3>
             <div className="flex flex-wrap gap-4">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="radio"
                   name="themeMode"
                   value="frosted"
                   checked={theme.mode === 'frosted'}
                   onChange={() => updateTheme({ mode: 'frosted' })}
                   className="text-primary focus:ring-primary"
                 />
                 <span className="text-sm text-gray-700">Frosted Glass</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="radio"
                   name="themeMode"
                   value="wallpaper"
                   checked={theme.mode === 'wallpaper'}
                   onChange={() => updateTheme({ mode: 'wallpaper' })}
                   className="text-primary focus:ring-primary"
                 />
                 <span className="text-sm text-gray-700">Custom Wallpaper</span>
               </label>
             </div>
           </div>

           {theme.mode === 'frosted' ? (
             <div className="space-y-6">
               <div className="space-y-4">
                 <h3 className="font-semibold text-gray-700">Frosted Glass Tone</h3>
                 <div className="flex gap-4">
                   {(['light', 'dark'] as const).map((tone) => (
                     <label key={tone} className="flex items-center gap-2 cursor-pointer">
                       <input
                         type="radio"
                         name="frostedTone"
                         value={tone}
                         checked={theme.frostedTone === tone}
                         onChange={() => updateTheme({ frostedTone: tone })}
                         className="text-primary focus:ring-primary"
                       />
                       <span className="capitalize text-sm text-gray-700">{tone}</span>
                     </label>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Frosted Opacity: {Math.round(theme.frostedOpacity * 100)}%
                 </label>
                 <input
                   type="range"
                   min="0.2"
                   max="1"
                   step="0.02"
                   value={theme.frostedOpacity}
                   onChange={(e) => updateTheme({ frostedOpacity: parseFloat(e.target.value) })}
                   className="w-full max-w-xs accent-primary"
                 />
               </div>
             </div>
           ) : (
             <div className="space-y-8">
               <div className="space-y-4">
                 <h3 className="font-semibold text-gray-700">Wallpaper Mask</h3>
                 <div className="flex gap-4">
                   {(['auto', 'light', 'dark'] as const).map((type) => (
                     <label key={type} className="flex items-center gap-2 cursor-pointer">
                       <input
                         type="radio"
                         name="maskType"
                         value={type}
                         checked={theme.maskType === type}
                         onChange={() => updateTheme({ maskType: type })}
                         className="text-primary focus:ring-primary"
                       />
                       <span className="capitalize text-sm text-gray-700">{type}</span>
                     </label>
                   ))}
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Mask Opacity: {Math.round(theme.maskOpacity * 100)}%
                   </label>
                   <input
                     type="range"
                     min="0"
                     max="1"
                     step="0.02"
                     value={theme.maskOpacity}
                     onChange={(e) => updateTheme({ maskOpacity: parseFloat(e.target.value) })}
                     className="w-full max-w-xs accent-primary"
                   />
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                   <h3 className="font-semibold text-gray-700 mb-3">Floating Button Wallpaper</h3>
                   <div className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors group">
                     {theme.floatingWallpaper ? (
                       <>
                         <img src={theme.floatingWallpaper} alt="Floating Wallpaper" className="w-full h-full object-cover" />
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
                         <span className="text-xs">Upload</span>
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
                   <h3 className="font-semibold text-gray-700 mb-3">Settings Panel Wallpaper</h3>
                   <div className="relative w-full max-w-xs h-40 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors group">
                     {theme.settingsWallpaper ? (
                       <>
                         <img src={theme.settingsWallpaper} alt="Settings Wallpaper" className="w-full h-full object-cover" />
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
                         <span className="text-xs">Upload</span>
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

       <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
           <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
               <Globe className="w-5 h-5 text-primary" />
               Auto-Translated Sites
           </h2>
           <p className="text-gray-500 mb-4 text-sm">
               Automatically translate these websites when you visit them.
           </p>

           <div className="mb-4">
               <input 
                   type="text" 
                   placeholder="Enter domain (e.g., example.com) and press Enter"
                   className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                   onKeyDown={handleAutoTranslateAdd}
               />
           </div>

           {(!settings.autoTranslateDomains || settings.autoTranslateDomains.length === 0) ? (
               <p className="text-gray-400 text-sm italic">No sites added yet.</p>
           ) : (
               <div className="space-y-2">
                   {settings.autoTranslateDomains.map(domain => (
                       <div key={domain} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg max-w-md group">
                           <span className="text-gray-700 font-medium">{domain}</span>
                           <button 
                               onClick={() => handleAutoTranslateRemove(domain)}
                               className="text-gray-400 hover:text-red-500 transition-colors"
                           >
                               <X className="w-4 h-4" />
                           </button>
                       </div>
                   ))}
               </div>
           )}
       </div>
    </div>
  );
};
