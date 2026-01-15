import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ApiConfig } from './components/ApiConfig';
import { ModelConfig } from './components/ModelConfig';
import { About } from './components/About';
import { useStore } from '@/store/useStore';

const Options: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const { loadSettings, isLoading } = useStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <h2 className="text-2xl font-bold mb-4">General Settings</h2>
              <p className="text-gray-500">
                Welcome to Ling Translate! Please configure your API and Models to get started.
              </p>
            </div>
          )}
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
