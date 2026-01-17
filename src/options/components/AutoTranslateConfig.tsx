import React from 'react';
import { useStore } from '@/store/useStore';
import { Globe, X } from 'lucide-react';

export const AutoTranslateConfig: React.FC = () => {
  const { settings, updateSettings } = useStore();

  const handleAutoTranslateRemove = (domain: string) => {
    const newDomains = settings.autoTranslateDomains?.filter(d => d !== domain) || [];
    updateSettings({ autoTranslateDomains: newDomains });
  };

  const handleAutoTranslateAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
     if (e.key === 'Enter') {
         const val = e.currentTarget.value.trim();
         // Ensure autoTranslateDomains is treated as an array
         const currentDomains = settings.autoTranslateDomains || [];
         if (val && !currentDomains.includes(val)) {
             updateSettings({
                 autoTranslateDomains: [...currentDomains, val]
             });
             e.currentTarget.value = '';
         }
     }
  };

  return (
    <div className="space-y-6">
       <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
           <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
               <Globe className="w-5 h-5 text-primary" />
               自动翻译的网站
           </h2>
           <p className="text-gray-500 mb-4 text-sm">
               访问这些网站时自动翻译。
           </p>

           <div className="mb-4">
               <input 
                   type="text" 
                   placeholder="输入域名（如 example.com），按回车添加"
                   className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                   onKeyDown={handleAutoTranslateAdd}
               />
           </div>

           {(!settings?.autoTranslateDomains || settings.autoTranslateDomains.length === 0) ? (
               <p className="text-gray-400 text-sm italic">暂无添加的网站。</p>
           ) : (
               <div className="space-y-2">
                   {settings.autoTranslateDomains?.map(domain => (
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
