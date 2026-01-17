import { UserSettings, DEFAULT_SETTINGS } from './types';

export const getSettings = async (): Promise<UserSettings> => {
  try {
    const result = await chrome.storage.local.get('settings');
    let settings = result.settings;

    if (!settings) {
       const syncResult = await chrome.storage.sync.get('settings');
       settings = syncResult.settings || {};
       if (Object.keys(settings).length > 0) {
           await chrome.storage.local.set({ settings });
       }
    }

    // Merge preferences from sync storage (if available)
    try {
        const syncPrefs = await chrome.storage.sync.get('preferences');
        if (syncPrefs.preferences && typeof syncPrefs.preferences === 'object') {
            const currentSettings = (settings && typeof settings === 'object') ? settings : {};
            settings = { ...currentSettings, ...syncPrefs.preferences };
        }
    } catch (e) {
        console.warn('Failed to fetch synced preferences:', e);
    }

    // Explicitly merge with defaults
    const merged = Object.assign({}, DEFAULT_SETTINGS, settings) as UserSettings;
    
    // Migration: showLoadingIcon -> loadingStyle
    // If loadingStyle is missing but showLoadingIcon exists, map it
    if (settings && typeof settings === 'object' && 'showLoadingIcon' in settings && !('loadingStyle' in settings)) {
        // @ts-ignore - accessing legacy property
        merged.loadingStyle = settings.showLoadingIcon ? 'both' : 'none';
    }

    return merged;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: UserSettings): Promise<void> => {
  try {
    await chrome.storage.local.set({ settings });
    
    // Sync specific preferences
    const syncSettings = {
      hideGlobalButton: settings.hideGlobalButton,
      hideDomains: settings.hideDomains,
      shortcuts: settings.shortcuts
    };
    
    try {
        await chrome.storage.sync.set({ preferences: syncSettings });
    } catch (syncError) {
        // Ignore sync errors (e.g., quota exceeded) but log them
        console.warn('Failed to sync preferences:', syncError);
    }
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
