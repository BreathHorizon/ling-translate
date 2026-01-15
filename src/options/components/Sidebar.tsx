import React from 'react';
import { Settings, Server, MessageSquare, Globe, Terminal, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'apis', label: 'API Management', icon: Server },
    { id: 'models', label: 'Models', icon: MessageSquare },
    { id: 'prompts', label: 'Prompts', icon: Terminal },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex-shrink-0 fixed left-0 top-0 overflow-y-auto">
      <div className="p-6">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <Globe className="w-6 h-6" />
          Ling Translate
        </h1>
      </div>
      <nav className="px-4 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
};
