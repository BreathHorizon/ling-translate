import { sha256 } from './utils';
import { logger } from './logger';

export class PageCache {
  private static CACHE_PREFIX = 'ling_page_cache_';
  private static stats = {
    hits: 0,
    misses: 0
  };

  /**
   * Initializes the cache for the current page.
   * Clears any existing cache for this page URL to ensure fresh start on reload.
   */
  static init() {
    const url = window.location.href;
    const keysToRemove: string[] = [];
    
    // Scan for keys belonging to this page
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(`${this.CACHE_PREFIX}${url}`)) {
        keysToRemove.push(key);
      }
    }

    // Clear them
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    // Reset stats
    this.stats = { hits: 0, misses: 0 };
    logger.info('Page cache initialized and cleared for current URL');
  }

  /**
   * Generates a unique cache key based on inputs
   */
  private static async generateKey(text: string, from: string, to: string, modelId: string): Promise<string> {
    const contentHash = await sha256(`${text}:${from}:${to}:${modelId}`);
    return `${this.CACHE_PREFIX}${window.location.href}::${contentHash}`;
  }

  /**
   * Retrieves a cached translation if available
   */
  static async get(text: string, from: string, to: string, modelId: string): Promise<string | null> {
    try {
      const key = await this.generateKey(text, from, to, modelId);
      const cached = sessionStorage.getItem(key);
      
      if (cached) {
        this.stats.hits++;
        return cached;
      }
      
      this.stats.misses++;
      return null;
    } catch (e) {
      console.warn('Cache read failed:', e);
      return null;
    }
  }

  /**
   * Stores a translation in the cache
   */
  static async set(text: string, from: string, to: string, modelId: string, translation: string): Promise<void> {
    try {
      const key = await this.generateKey(text, from, to, modelId);
      sessionStorage.setItem(key, translation);
    } catch (e) {
      // Handle quota exceeded or other errors
      console.warn('Cache write failed:', e);
      // Optional: Clear some old cache if quota exceeded? 
      // For now, we just ignore write failures as cache is enhancement.
    }
  }

  /**
   * Returns current cache statistics
   */
  static getStats() {
    const total = this.stats.hits + this.stats.misses;
    const rate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : '0.0';
    return {
      ...this.stats,
      rate: `${rate}%`
    };
  }
}
