export interface ModelConfig {
  id: string;
  name: string;
  maxTokens: number;
  maxParagraphs: number;
  concurrency?: number;
  requestsPerSecond?: number;
  systemPrompt: string;
  prompt: string;
  systemMultiplePrompt: string;
  multiplePrompt: string;
}

export interface ApiConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: ModelConfig[];
}

export interface SitePreference {
  preference: 'always' | 'never' | 'ask';
}

export interface DeveloperSettings {
  enabled: boolean;
  logDom: boolean;
  logTranslation: boolean;
  logNetwork: boolean;
}

export interface UserSettings {
  defaultFromLang: string;
  defaultToLang: string;
  defaultModelId: string; // Format: "apiId:modelId"
  sitePreferences: Record<string, SitePreference>;
  apiConfigs: ApiConfig[];
  showLoadingIcon: boolean;
  developer: DeveloperSettings;
}

export type ExtensionMessage = 
  | TranslationRequest
  | { type: 'OPEN_OPTIONS_PAGE' }
  | { type: 'TEST_CONNECTION', payload: { baseUrl: string; apiKey: string; modelName?: string } }
  | { type: 'TEST_MODEL', payload: { apiId: string; modelConfig: ModelConfig } };

export interface TranslationRequest {
  type: 'TRANSLATE_TEXT';
  payload: {
    text: string;
    from: string;
    to: string;
    contentType: 'html' | 'text';
    modelId: string; // Format: "apiId:modelId"
  };
}

export interface TranslationResponse {
  success: boolean;
  data?: {
    translatedText: string;
    originalText: string;
  };
  error?: string;
}

export interface ExtensionStorage {
  settings: UserSettings;
  cache: {
    translations: Record<string, {
      text: string;
      translation: string;
      timestamp: number;
    }>;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultFromLang: 'auto',
  defaultToLang: 'zh-CN',
  defaultModelId: 'default-api:default-model',
  sitePreferences: {},
  apiConfigs: [],
  showLoadingIcon: true,
  developer: {
    enabled: false,
    logDom: false,
    logTranslation: false,
    logNetwork: false
  }
};
