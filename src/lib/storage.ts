import { UserSettings, DEFAULT_SETTINGS } from './types';

export const getSettings = async (): Promise<UserSettings> => {
  try {
    const result = await chrome.storage.local.get('settings');
    // Migrate from sync if local is empty? 
    // For now, let's just assume local. If we wanted to be robust we could check sync first.
    // But given the instruction to switch, I'll stick to local.
    // However, existing users might lose settings. 
    // Ideally: Check local, if empty check sync, if sync exists, save to local and return.
    if (!result.settings) {
       const syncResult = await chrome.storage.sync.get('settings');
       if (syncResult.settings) {
           await chrome.storage.local.set({ settings: syncResult.settings });
           return (syncResult.settings as UserSettings) || DEFAULT_SETTINGS;
       }
    }
    return (result.settings as UserSettings) || DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: UserSettings): Promise<void> => {
  try {
    await chrome.storage.local.set({ settings });
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
