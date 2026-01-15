import { create } from 'zustand';
import { UserSettings, DEFAULT_SETTINGS, ApiConfig } from '../lib/types';
import { getSettings, saveSettings } from '../lib/storage';

interface StoreState {
  settings: UserSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  addApiConfig: (config: ApiConfig) => Promise<void>;
  updateApiConfig: (config: ApiConfig) => Promise<void>;
  deleteApiConfig: (id: string) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  loadSettings: async () => {
    set({ isLoading: true });
    const settings = await getSettings();
    set({ settings, isLoading: false });
  },
  updateSettings: async (newSettings) => {
    const updatedSettings = { ...get().settings, ...newSettings };
    set({ settings: updatedSettings });
    await saveSettings(updatedSettings);
  },
  addApiConfig: async (config) => {
    const { settings } = get();
    const updatedSettings = {
      ...settings,
      apiConfigs: [...settings.apiConfigs, config],
    };
    set({ settings: updatedSettings });
    await saveSettings(updatedSettings);
  },
  updateApiConfig: async (config) => {
    const { settings } = get();
    const updatedSettings = {
      ...settings,
      apiConfigs: settings.apiConfigs.map((c) => (c.id === config.id ? config : c)),
    };
    set({ settings: updatedSettings });
    await saveSettings(updatedSettings);
  },
  deleteApiConfig: async (id) => {
    const { settings } = get();
    const updatedSettings = {
      ...settings,
      apiConfigs: settings.apiConfigs.filter((c) => c.id !== id),
    };
    set({ settings: updatedSettings });
    await saveSettings(updatedSettings);
  },
}));
