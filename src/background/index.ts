import { TranslationRequest, TranslationResponse, ApiConfig, ModelConfig, ExtensionMessage } from '@/lib/types';
import { getSettings, getCache, setCache } from '@/lib/storage';
import { sha256 } from '@/lib/utils';

console.log('Background script loaded');

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Chrome Translator Extension installed');
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'TRANSLATE_TEXT') {
    handleTranslation(message.payload).then(sendResponse);
    return true; // Keep channel open for async response
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
        max_tokens: 500 // Increased tokens for longer text
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
    // Ensure baseUrl doesn't end with slash
    const cleanUrl = baseUrl.replace(/\/$/, '');
    
    // Try listing models first as it's a lightweight GET request
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

  // Check Cache
  const cacheKeyBase = `${payload.text}-${payload.to}-${payload.modelId}`;
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
    const translatedText = await callOpenAI(payload.text, payload.to, apiConfig, modelConfig);
    
    // Save to Cache
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

async function callOpenAI(text: string, targetLang: string, api: ApiConfig, model: ModelConfig): Promise<string> {
  // Replace variables in prompt
  const systemPrompt = model.systemPrompt.replace('{{to}}', targetLang);
  const userPrompt = model.prompt.replace('{{to}}', targetLang).replace('{{text}}', text);

  const response = await fetch(`${api.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${api.apiKey}`
    },
    body: JSON.stringify({
      model: model.name, 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}
