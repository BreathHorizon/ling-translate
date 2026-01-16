import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Trash2, Plus, Save, Edit2, ChevronDown, ChevronRight, Loader2, Play } from 'lucide-react';
import { ModelConfig as IModelConfig } from '@/lib/types';
import { generateId } from '@/lib/utils';

export const ModelConfig: React.FC = () => {
  const { settings, updateApiConfig } = useStore();
  const [expandedApiId, setExpandedApiId] = useState<string | null>(null);
  const [editingApiId, setEditingApiId] = useState<string | null>(null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<IModelConfig>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    content: any;
  }>({ isOpen: false, title: '', content: null });

  const handleEditModel = (apiId: string, model: IModelConfig) => {
    setEditingApiId(apiId);
    setEditingModelId(model.id);
    setFormData({
      ...model,
      concurrency: model.concurrency ?? 4,
      requestsPerSecond: model.requestsPerSecond ?? model.concurrency ?? 12
    });
  };

  const handleAddModel = (apiId: string) => {
    setEditingApiId(apiId);
    setEditingModelId(null);
    setFormData({
      name: 'deepseek-v3.2',
      maxTokens: 2000,
      maxParagraphs: 5,
      concurrency: 4,
      requestsPerSecond: 12,
      systemPrompt: '你是一位专业的 {{to}} 母语翻译者，需要流畅地将文本翻译成 {{to}}。\n\n## 翻译规则\n1. 仅输出翻译内容，不要包含解释或其他额外内容\n2. 返回的翻译必须保持与原文完全相同的段落数和格式\n3. 如果文本包含 HTML 标签，在保持流畅性的同时，请考虑标签在翻译中的位置\n4. 对于不应翻译的内容（如专有名词、代码等），请保留原文\n5. 直接输出翻译（无分隔符，无额外文本）',
      prompt: '翻译成 {{to}}（仅输出翻译）：\n\n{{text}}',
      systemMultiplePrompt: '你是一位专业的 {{to}} 母语翻译者，需要流畅地将文本翻译成 {{to}}。\n\n## 翻译规则\n1. 仅输出翻译内容，不要包含解释或其他额外内容\n2. 返回的翻译必须保持与原文完全相同的段落数和格式\n3. 如果文本包含 HTML 标签，在保持流畅性的同时，请考虑标签在翻译中的位置\n4. 对于不应翻译的内容（如专有名词、代码等），请保留原文\n\n## 输入输出格式示例\n\n### 输入示例：\nParagraph A\n\n%%\n\nParagraph B\n\n### 输出示例：\nTranslation A\n\n%%\n\nTranslation B',
      multiplePrompt: '翻译成 {{to}}：\n\n{{text}}'
    });
  };

  const handleTestModel = async () => {
    if (!editingApiId || !formData.name) return;

    setIsTesting(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_MODEL',
        payload: {
          apiId: editingApiId,
          modelConfig: formData as IModelConfig
        }
      });

      setModalState({
        isOpen: true,
        title: response.success ? 'Model Test Successful' : 'Model Test Failed',
        content: response.data || { error: response.error }
      });
    } catch {
      setModalState({
        isOpen: true,
        title: 'Model Test Failed',
        content: { error: 'Failed to send test request' }
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!editingApiId || !formData.name) return;

    const api = settings.apiConfigs.find(a => a.id === editingApiId);
    if (!api) return;

    const normalizedFormData: IModelConfig = {
      ...(formData as IModelConfig),
      concurrency: Math.max(1, Number(formData.concurrency) || 1),
      requestsPerSecond: Math.max(1, Number(formData.requestsPerSecond) || Number(formData.concurrency) || 1)
    };

    let updatedModels = [...api.models];
    if (editingModelId) {
      updatedModels = updatedModels.map(m => m.id === editingModelId ? { ...m, ...normalizedFormData } : m);
    } else {
      updatedModels.push({ ...normalizedFormData, id: generateId() });
    }

    await updateApiConfig({ ...api, models: updatedModels });
    setEditingApiId(null);
    setEditingModelId(null);
    setFormData({});
  };

  const handleDeleteModel = async (apiId: string, modelId: string) => {
    const api = settings.apiConfigs.find(a => a.id === apiId);
    if (!api) return;

    const updatedModels = api.models.filter(m => m.id !== modelId);
    await updateApiConfig({ ...api, models: updatedModels });
  };

  const toggleExpand = (apiId: string) => {
    setExpandedApiId(expandedApiId === apiId ? null : apiId);
  };

  if (editingApiId) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>{editingModelId ? 'Edit Model' : 'Add Model'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Model Name (e.g. gpt-4)"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Max Tokens"
                type="number"
                value={formData.maxTokens || 0}
                onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              />
              <Input
                label="Max Paragraphs"
                type="number"
                value={formData.maxParagraphs || 0}
                onChange={(e) => setFormData({ ...formData, maxParagraphs: parseInt(e.target.value) })}
              />
              <Input
                label="Concurrency (Threads)"
                type="number"
                min={1}
                value={formData.concurrency || 1}
                onChange={(e) => setFormData({ ...formData, concurrency: parseInt(e.target.value) || 1 })}
              />
              <Input
                label="Requests Per Second"
                type="number"
                min={1}
                value={formData.requestsPerSecond || 1}
                onChange={(e) => setFormData({ ...formData, requestsPerSecond: parseInt(e.target.value) || 1 })}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">System Prompt</label>
              <textarea
                className="w-full h-24 p-2 border rounded-md text-sm font-mono"
                value={formData.systemPrompt || ''}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">User Prompt</label>
              <textarea
                className="w-full h-24 p-2 border rounded-md text-sm font-mono"
                value={formData.prompt || ''}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              />
            </div>

            <div className="flex gap-2 justify-between mt-4">
              <Button 
                variant="outline" 
                onClick={handleTestModel}
                disabled={isTesting || !formData.name}
              >
                {isTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Test Model
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingApiId(null)}>Cancel</Button>
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
      <h2 className="text-2xl font-bold text-gray-800">Model Configuration</h2>
      
      {settings.apiConfigs.length === 0 && (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
          Please configure an API first.
        </div>
      )}

      {settings.apiConfigs.map((api) => (
        <Card key={api.id}>
          <div 
            className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleExpand(api.id)}
          >
            <div className="flex items-center gap-2">
              {expandedApiId === api.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              <h3 className="font-bold text-lg">{api.name}</h3>
              <span className="text-sm text-gray-500">({api.models.length} models)</span>
            </div>
            <Button 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                handleAddModel(api.id);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Model
            </Button>
          </div>
          
          {expandedApiId === api.id && (
            <CardContent className="border-t bg-gray-50/50">
              <div className="space-y-3 pt-4">
                {api.models.map((model) => (
                  <div key={model.id} className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
                    <div>
                      <h4 className="font-bold">{model.name}</h4>
                      <p className="text-xs text-gray-500">
                        Max Tokens: {model.maxTokens} | Max Paragraphs: {model.maxParagraphs} | Concurrency: {model.concurrency ?? 4} | Req/sec: {model.requestsPerSecond ?? model.concurrency ?? 12}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditModel(api.id, model)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteModel(api.id, model.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {api.models.length === 0 && (
                  <p className="text-center text-gray-500 py-4 text-sm">No models configured for this API.</p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};
