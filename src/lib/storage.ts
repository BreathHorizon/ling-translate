import { UserSettings, DEFAULT_SETTINGS } from './types';

export const getSettings = async (): Promise<UserSettings> => {
  try {
    const result = await chrome.storage.sync.get('settings');
    return (result.settings as UserSettings) || DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: UserSettings): Promise<void> => {
  try {
    await chrome.storage.sync.set({ settings });
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

export const getCache = async (key: string): Promise<string | null> => {
  try {
    const result = await chrome.storage.local.get(`cache:${key}`);
    const item = result[`cache:${key}`] as { translation: string } | undefined;
    return item?.translation || null;
  } catch {
    return null;
  }
};

export const setCache = async (key: string, translation: string, originalText: string): Promise<void> => {
  try {
    await chrome.storage.local.set({
      [`cache:${key}`]: {
        translation,
        text: originalText,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Failed to set cache:', error);
  }
};
