import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Trash2, Plus, Save, Edit2, ChevronDown, ChevronRight, Loader2, Play, CheckCircle2, XCircle } from 'lucide-react';
import { ModelConfig as IModelConfig, ApiConfig as IApiConfig } from '@/lib/types';
import { generateId } from '@/lib/utils';

export const ModelConfig: React.FC = () => {
  const { settings, updateApiConfig, addApiConfig, deleteApiConfig } = useStore();
  
  // Model State
  const [expandedApiId, setExpandedApiId] = useState<string | null>(null);
  const [editingApiId, setEditingApiId] = useState<string | null>(null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<IModelConfig>>({});
  
  // API State
  const [isAddingApi, setIsAddingApi] = useState(false);
  const [editingApiConfigId, setEditingApiConfigId] = useState<string | null>(null);
  const [apiFormData, setApiFormData] = useState<Partial<IApiConfig>>({});
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Shared State
  const [isTesting, setIsTesting] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    content: unknown;
  }>({ isOpen: false, title: '', content: null });

  // --- API Handlers ---

  const handleEditApiConfig = (e: React.MouseEvent, api: IApiConfig) => {
    e.stopPropagation();
    setApiFormData(api);
    setEditingApiConfigId(api.id);
    setIsAddingApi(false);
    setApiTestResult(null);
  };

  const handleAddApiConfig = () => {
    setApiFormData({
      name: '',
      baseUrl: '',
      apiKey: '',
      models: []
    });
    setEditingApiConfigId(null);
    setIsAddingApi(true);
    setApiTestResult(null);
  };

  const handleDeleteApiConfig = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除此 API 及其所有模型吗？')) {
        await deleteApiConfig(id);
    }
  };

  const handleTestApiConnection = async () => {
    if (!apiFormData.baseUrl || !apiFormData.apiKey) return;
    
    setIsTesting(true);
    setApiTestResult(null);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        payload: {
          baseUrl: apiFormData.baseUrl,
          apiKey: apiFormData.apiKey
        }
      });

      setModalState({
        isOpen: true,
        title: response.success ? '连接成功' : '连接失败',
        content: response.data || { error: response.error }
      });

      if (response.success) {
        setApiTestResult({ success: true, message: '连接成功！' });
      } else {
        setApiTestResult({ success: false, message: response.error || '连接失败' });
      }
    } catch {
      setApiTestResult({ success: false, message: '发送测试请求失败' });
      setModalState({
        isOpen: true,
        title: '连接失败',
        content: { error: '发送测试请求失败' }
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveApiConfig = async () => {
    if (!apiFormData.name || !apiFormData.baseUrl || !apiFormData.apiKey) return;

    if (editingApiConfigId) {
      await updateApiConfig(apiFormData as IApiConfig);
    } else {
      await addApiConfig({
        ...apiFormData,
        id: generateId(),
        models: []
      } as IApiConfig);
    }
    setEditingApiConfigId(null);
    setIsAddingApi(false);
    setApiFormData({});
    setApiTestResult(null);
  };

  const handleCancelApiConfig = () => {
    setEditingApiConfigId(null);
    setIsAddingApi(false);
    setApiFormData({});
    setApiTestResult(null);
  };

  // --- Model Handlers ---

  const handleEditModel = (apiId: string, model: IModelConfig) => {
    setEditingApiId(apiId);
    setEditingModelId(model.id);
    setFormData({
      ...model,
      temperature: model.temperature ?? 0.3,
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
      temperature: 0.3,
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
        title: response.success ? '模型测试成功' : '模型测试失败',
        content: response.data || { error: response.error }
      });
    } catch {
      setModalState({
        isOpen: true,
        title: '模型测试失败',
        content: { error: '发送测试请求失败' }
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveModel = async () => {
    if (!editingApiId || !formData.name) return;

    const api = settings.apiConfigs.find(a => a.id === editingApiId);
    if (!api) return;

    const normalizedFormData: IModelConfig = {
      ...(formData as IModelConfig),
      temperature: (() => {
        const temp = typeof formData.temperature === 'number' ? formData.temperature : Number(formData.temperature);
        const normalized = Number.isFinite(temp) ? temp : 0.3;
        return Math.min(2, Math.max(0, normalized));
      })(),
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

  // --- Render ---

  if (isAddingApi || editingApiConfigId) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>{isAddingApi ? '添加新 API' : '编辑 API'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="名称"
              value={apiFormData.name || ''}
              onChange={(e) => setApiFormData({ ...apiFormData, name: e.target.value })}
              placeholder="例如：OpenAI"
            />
            <div className="space-y-1">
              <Input
                label="基础 URL"
                value={apiFormData.baseUrl || ''}
                onChange={(e) => setApiFormData({ ...apiFormData, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
              {apiFormData.baseUrl && (
                <p className="text-xs text-gray-400 mt-1 px-1 break-all">
                  完整路径：<span className="font-mono">{apiFormData.baseUrl.replace(/\/$/, '')}/chat/completions</span>
                </p>
              )}
            </div>
            <Input
              label="API 密钥"
              type="password"
              value={apiFormData.apiKey || ''}
              onChange={(e) => setApiFormData({ ...apiFormData, apiKey: e.target.value })}
              placeholder="sk-..."
            />
            
            <div className="flex items-center justify-between mt-4">
               <div className="flex items-center gap-2">
                 <Button 
                   variant="outline" 
                   size="sm"
                   onClick={handleTestApiConnection} 
                   disabled={isTesting || !apiFormData.baseUrl || !apiFormData.apiKey}
                   className="relative"
                 >
                   {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                   测试连接
                 </Button>
                 
                 {apiTestResult && (
                   <div className={`flex items-center gap-1 text-sm ${apiTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                     {apiTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                     {apiTestResult.message}
                   </div>
                 )}
               </div>

               <div className="flex gap-2">
                 <Button variant="outline" onClick={handleCancelApiConfig}>取消</Button>
                 <Button onClick={handleSaveApiConfig}>
                   <Save className="w-4 h-4 mr-2" />
                   保存
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
              关闭
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  if (editingApiId) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>{editingModelId ? '编辑模型' : '添加模型'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="模型名称（如 gpt-4）"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="最大 Token 数"
                type="number"
                value={formData.maxTokens || 0}
                onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              />
              <Input
                label="最大段落数"
                type="number"
                value={formData.maxParagraphs || 0}
                onChange={(e) => setFormData({ ...formData, maxParagraphs: parseInt(e.target.value) })}
              />
              <Input
                label="温度"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={formData.temperature ?? 0.3}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    temperature: e.target.value === '' ? undefined : parseFloat(e.target.value)
                  })
                }
                />
              <Input
                label="并发（线程）"
                type="number"
                min={1}
                value={formData.concurrency || 1}
                onChange={(e) => setFormData({ ...formData, concurrency: parseInt(e.target.value) || 1 })}
              />
              <Input
                label="每秒请求数"
                type="number"
                min={1}
                value={formData.requestsPerSecond || 1}
                onChange={(e) => setFormData({ ...formData, requestsPerSecond: parseInt(e.target.value) || 1 })}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">系统提示词</label>
              <textarea
                className="w-full h-24 p-2 border rounded-md text-sm font-mono"
                value={formData.systemPrompt || ''}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">用户提示词</label>
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
                测试模型
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingApiId(null)}>取消</Button>
                <Button onClick={handleSaveModel}>
                  <Save className="w-4 h-4 mr-2" />
                  保存
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
              关闭
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">配置</h2>
        <Button onClick={handleAddApiConfig}>
          <Plus className="w-4 h-4 mr-2" />
          添加 API
        </Button>
      </div>
      
      {settings.apiConfigs.length === 0 && (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
          请先配置 API。
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
              <span className="text-sm text-gray-500">（{api.models.length} 个模型）</span>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => handleEditApiConfig(e, api)}
                title="编辑 API"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-red-500 hover:text-red-600 hover:bg-red-50" 
                onClick={(e) => handleDeleteApiConfig(e, api.id)}
                title="删除 API"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <div className="w-px h-4 bg-gray-300 mx-2" />
              <Button 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddModel(api.id);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                添加模型
              </Button>
            </div>
          </div>
          
          {expandedApiId === api.id && (
            <CardContent className="border-t bg-gray-50/50">
              <div className="space-y-3 pt-4">
                {api.models.map((model) => (
                  <div key={model.id} className="flex items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
                    <div>
                      <h4 className="font-bold">{model.name}</h4>
                      <p className="text-xs text-gray-500">
                        最大 Token 数：{model.maxTokens} | 最大段落数：{model.maxParagraphs} | 温度：{model.temperature ?? 0.3} | 并发：{model.concurrency ?? 4} | 每秒请求：{model.requestsPerSecond ?? model.concurrency ?? 12}
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
                  <p className="text-center text-gray-500 py-4 text-sm">该 API 尚未配置模型。</p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};
