import { UserSettings } from './types';

class Logger {
  private settings: UserSettings['developer'] | null = null;

  updateSettings(settings: UserSettings['developer']) {
    this.settings = settings;
  }

  dom(...args: any[]) {
    if (this.settings?.enabled && this.settings?.logDom) {
      console.log('%c[DOM]', 'color: #2563eb; font-weight: bold;', ...args);
    }
  }

  translation(...args: any[]) {
    if (this.settings?.enabled && this.settings?.logTranslation) {
      console.log('%c[Translation]', 'color: #16a34a; font-weight: bold;', ...args);
    }
  }

  network(...args: any[]) {
    if (this.settings?.enabled && this.settings?.logNetwork) {
      console.log('%c[Network]', 'color: #dc2626; font-weight: bold;', ...args);
    }
  }

  info(...args: any[]) {
    if (this.settings?.enabled) {
      console.log('%c[Info]', 'color: #6b7280; font-weight: bold;', ...args);
    }
  }
}

export const logger = new Logger();
