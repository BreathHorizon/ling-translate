import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Trash2, Plus, Save, Edit2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { ApiConfig as IApiConfig } from '@/lib/types';
import { generateId } from '@/lib/utils';

export const ApiConfig: React.FC = () => {
  const { settings, addApiConfig, updateApiConfig, deleteApiConfig } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<IApiConfig>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    content: any;
  }>({ isOpen: false, title: '', content: null });

  const handleEdit = (api: IApiConfig) => {
    setFormData(api);
    setEditingId(api.id);
    setIsAdding(false);
    setTestResult(null);
  };

  const handleAddNew = () => {
    setFormData({
      name: '',
      baseUrl: '',
      apiKey: '',
      models: []
    });
    setEditingId(null);
    setIsAdding(true);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!formData.baseUrl || !formData.apiKey) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        payload: {
          baseUrl: formData.baseUrl,
          apiKey: formData.apiKey
        }
      });

      setModalState({
        isOpen: true,
        title: response.success ? 'Connection Successful' : 'Connection Failed',
        content: response.data || { error: response.error }
      });

      if (response.success) {
        setTestResult({ success: true, message: 'Connection successful!' });
      } else {
        setTestResult({ success: false, message: response.error || 'Connection failed' });
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to send test request' });
      setModalState({
        isOpen: true,
        title: 'Connection Failed',
        content: { error: 'Failed to send test request' }
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.baseUrl || !formData.apiKey) return;

    if (editingId) {
      await updateApiConfig(formData as IApiConfig);
    } else {
      await addApiConfig({
        ...formData,
        id: generateId(),
        models: []
      } as IApiConfig);
    }
    setEditingId(null);
    setIsAdding(false);
    setFormData({});
    setTestResult(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({});
    setTestResult(null);
  };

  if (isAdding || editingId) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>{isAdding ? 'Add New API' : 'Edit API'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., OpenAI"
            />
            <div className="space-y-1">
              <Input
                label="Base URL"
                value={formData.baseUrl || ''}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
              {formData.baseUrl && (
                <p className="text-xs text-gray-400 mt-1 px-1 break-all">
                  Full path: <span className="font-mono">{formData.baseUrl.replace(/\/$/, '')}/chat/completions</span>
                </p>
              )}
            </div>
            <Input
              label="API Key"
              type="password"
              value={formData.apiKey || ''}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="sk-..."
            />
            
            <div className="flex items-center justify-between mt-4">
               <div className="flex items-center gap-2">
                 <Button 
                   variant="outline" 
                   size="sm"
                   onClick={handleTestConnection} 
                   disabled={isTesting || !formData.baseUrl || !formData.apiKey}
                   className="relative"
                 >
                   {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                   Test Connection
                 </Button>
                 
                 {testResult && (
                   <div className={`flex items-center gap-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                     {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                     {testResult.message}
                   </div>
                 )}
               </div>

               <div className="flex gap-2">
                 <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                 <Button onClick={handleSave}>
                   <Save className="w-4 h-4 mr-2" />
                   Save
                 </Button>
               </div>
            </div>
          </CardContent>
        </Card>

        <Modal
          isOpen={modalState.isOpen}
          onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
          title={modalState.title}
          className="max-w-3xl"
        >
          <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-[60vh] text-xs font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(modalState.content, null, 2)}
          </pre>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}>
              Close
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">API Configurations</h2>
        <Button onClick={handleAddNew}>
          <Plus className="w-4 h-4 mr-2" />
          Add API
        </Button>
      </div>

      <div className="grid gap-4">
        {settings.apiConfigs.map((api) => (
          <Card key={api.id}>
            <CardContent className="flex justify-between items-center p-6">
              <div>
                <h3 className="font-bold text-lg">{api.name}</h3>
                <p className="text-sm text-gray-500">{api.baseUrl}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(api)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteApiConfig(api.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {settings.apiConfigs.length === 0 && (
          <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
            No APIs configured yet.
          </div>
        )}
      </div>
    </div>
  );
};
