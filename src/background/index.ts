import { TranslationRequest, TranslationResponse, ApiConfig, ModelConfig, ExtensionMessage } from '@/lib/types';
import { getSettings, getCache, setCache } from '@/lib/storage';
import { sha256 } from '@/lib/utils';

console.log('Background script loaded');

const LANG_CODE_TO_NAME: Record<string, string> = {
  'zh-CN': 'Chinese (Simplified)',
  'en': 'English',
  'ja': 'Japanese',
  'ko': 'Korean',
  'fr': 'French',
  'de': 'German',
  'es': 'Spanish',
  'auto': 'auto-detect',
};

const createRequestLimiter = (initialConcurrency: number, initialRequestsPerSecond: number) => {
  let concurrency = Math.max(1, initialConcurrency);
  let requestsPerSecond = Math.max(1, initialRequestsPerSecond);
  let intervalMs = 1000 / requestsPerSecond;
  let nextAvailableTime = 0;
  let activeCount = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  const schedule = () => {
    if (activeCount >= concurrency || queue.length === 0) return;

    const now = Date.now();
    const scheduledTime = Math.max(now, nextAvailableTime);
    const delay = scheduledTime - now;

    if (delay > 0) {
      if (timerId !== null) return;
      timerId = setTimeout(() => {
        timerId = null;
        schedule();
      }, delay);
      return;
    }

    const task = queue.shift();
    if (!task) return;

    nextAvailableTime = scheduledTime + intervalMs;
    activeCount += 1;

    task.fn()
      .then(task.resolve)
      .catch(task.reject)
      .finally(() => {
        activeCount = Math.max(0, activeCount - 1);
        schedule();
      });

    schedule();
  };

  const enqueue = async <T,>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      schedule();
    });
  };

  const updateLimits = (newConcurrency: number, newRequestsPerSecond: number) => {
    concurrency = Math.max(1, newConcurrency);
    requestsPerSecond = Math.max(1, newRequestsPerSecond);
    intervalMs = 1000 / requestsPerSecond;
    schedule();
  };

  return { enqueue, updateLimits };
};

const modelLimiters = new Map<string, ReturnType<typeof createRequestLimiter>>();

const getModelLimiter = (modelKey: string, concurrencyLimit: number, requestsPerSecondLimit: number) => {
  const normalizedConcurrency = Math.max(1, concurrencyLimit);
  const normalizedRequestsPerSecond = Math.max(1, requestsPerSecondLimit);
  const existing = modelLimiters.get(modelKey);
  if (existing) {
    existing.updateLimits(normalizedConcurrency, normalizedRequestsPerSecond);
    return existing;
  }

  const limiter = createRequestLimiter(normalizedConcurrency, normalizedRequestsPerSecond);
  modelLimiters.set(modelKey, limiter);
  return limiter;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
};

const stripThoughtBlocks = (text: string): string => {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/<analysis>[\s\S]*$/gi, '')
    .trim();
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Chrome Translator Extension installed');
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'TRANSLATE_TEXT') {
    handleTranslation(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === 'OPEN_OPTIONS_PAGE') {
    chrome.runtime.openOptionsPage();
  }
  if (message.type === 'TEST_CONNECTION') {
    testConnection(message.payload.baseUrl, message.payload.apiKey).then(sendResponse);
    return true;
  }
  if (message.type === 'TEST_MODEL') {
    testModel(message.payload.apiId, message.payload.modelConfig).then(sendResponse);
    return true;
  }
});

async function testModel(apiId: string, modelConfig: ModelConfig): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const settings = await getSettings();
    const apiConfig = settings.apiConfigs.find(api => api.id === apiId);
    
    if (!apiConfig) {
      return { success: false, error: 'API Configuration not found' };
    }

    const testText = `If you're not careful and no-clip out of reality in wrong areas, you'll end up in the Backrooms, where it's nothing but the stink of moist carpet, the madness of mono-yellow, and endless background noise of fluorescent lights at maximum hum-buzz, and approximately six hundred million square miles of randomly segmented empty rooms to be trapped in. God save you if you hear something wandering around nearby, because it sure as hell has heard you…`;
    const targetLang = 'Chinese';

    const systemPrompt = modelConfig.systemPrompt.replace('{{to}}', targetLang);
    const userPrompt = modelConfig.prompt.replace('{{to}}', targetLang).replace('{{text}}', testText);

    const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.name, 
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    const responseData = await response.json().catch(() => null);

    if (response.ok) {
      return { success: true, data: responseData };
    }

    return { 
      success: false, 
      data: responseData,
      error: responseData?.error?.message || `HTTP ${response.status} ${response.statusText}` 
    };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function testConnection(baseUrl: string, apiKey: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    
    const response = await fetch(`${cleanUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const responseData = await response.json().catch(() => null);

    if (response.ok) {
      return { success: true, data: responseData };
    }

    return { 
      success: false, 
      data: responseData,
      error: responseData?.error?.message || `HTTP ${response.status} ${response.statusText}` 
    };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function handleTranslation(payload: TranslationRequest['payload']): Promise<TranslationResponse> {
  const settings = await getSettings();
  
  if (!payload.modelId) {
     return { success: false, error: 'No model selected' };
  }

  const cacheKeyBase = `${payload.text}-${payload.to}-${payload.modelId}-${payload.contentType}`;
  const cacheKey = await sha256(cacheKeyBase);
  const cachedTranslation = await getCache(cacheKey);

  if (cachedTranslation) {
    return {
      success: true,
      data: {
        translatedText: cachedTranslation,
        originalText: payload.text
      }
    };
  }

  const [apiId, modelId] = payload.modelId.split(':');

  const apiConfig = settings.apiConfigs.find(api => api.id === apiId);
  if (!apiConfig) return { success: false, error: 'API Configuration not found' };

  const modelConfig = apiConfig.models.find(model => model.id === modelId);
  if (!modelConfig) return { success: false, error: 'Model Configuration not found' };

  try {
    const limiter = getModelLimiter(
      payload.modelId,
      modelConfig.concurrency ?? 4,
      modelConfig.requestsPerSecond ?? modelConfig.concurrency ?? 12
    );
    const translatedText = await limiter.enqueue(() =>
      callOpenAI(payload.text, payload.to, apiConfig, modelConfig, payload.contentType)
    );
    
    await setCache(cacheKey, translatedText, payload.text);

    return {
      success: true,
      data: {
        translatedText,
        originalText: payload.text
      }
    };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

async function callOpenAI(
  text: string,
  targetLang: string,
  api: ApiConfig,
  model: ModelConfig,
  contentType: TranslationRequest['payload']['contentType']
): Promise<string> {
  const langName = LANG_CODE_TO_NAME[targetLang] || targetLang;
  const useMultiple = contentType === 'multi' && model.systemMultiplePrompt && model.multiplePrompt;
  const systemPrompt = (useMultiple ? model.systemMultiplePrompt : model.systemPrompt)
    .replace('{{to}}', langName);
  const userPrompt = (useMultiple ? model.multiplePrompt : model.prompt)
    .replace('{{to}}', langName)
    .replace('{{text}}', text);

  const requestBody: Record<string, unknown> = {
    model: model.name,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3
  };

  if (Number.isFinite(model.maxTokens) && model.maxTokens > 0) {
    requestBody.max_tokens = model.maxTokens;
  }

  const response = await fetch(`${api.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${api.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return stripThoughtBlocks(content);
}
