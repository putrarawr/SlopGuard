/**
 * SlopGuard — Cache Manager
 * In-memory LRU cache + chrome.storage.local persistent cache dengan TTL.
 */

import { CACHE } from '../shared/constants.js';

export class CacheManager {
  constructor() {
    /** @type {Map<string, { data: object, timestamp: number }>} */
    this._memoryCache = new Map();
    this._maxMemoryEntries = CACHE.MAX_MEMORY_ENTRIES;
  }

  /**
   * Cek cache: in-memory dulu, lalu storage.local.
   * @param {string} contentHash
   * @returns {Promise<object|null>}
   */
  async get(contentHash) {
    if (!contentHash) return null;

    // 1. Cek in-memory cache
    const memEntry = this._memoryCache.get(contentHash);
    if (memEntry && !this._isExpired(memEntry)) {
      // Move to end (most recently used)
      this._memoryCache.delete(contentHash);
      this._memoryCache.set(contentHash, memEntry);
      return memEntry.data;
    }

    // Remove jika expired
    if (memEntry) {
      this._memoryCache.delete(contentHash);
    }

    // 2. Cek chrome.storage.local
    try {
      const storageData = await this._getFromStorage(contentHash);
      if (storageData && !this._isExpired(storageData)) {
        // Promote ke in-memory cache
        this._setMemory(contentHash, storageData.data, storageData.timestamp, storageData.ttl);
        return storageData.data;
      }

      // Clean up expired entry
      if (storageData) {
        await this._removeFromStorage(contentHash);
      }
    } catch (error) {
      console.warn('[SlopGuard Cache] Storage read error:', error);
    }

    return null;
  }

  /**
   * Simpan ke kedua cache layer.
   * @param {string} contentHash
   * @param {object} data
   * @param {number} ttlMs
   */
  async set(contentHash, data, ttlMs = CACHE.DEFAULT_TTL_MS) {
    if (!contentHash || !data) return;

    const timestamp = Date.now();

    // Set in-memory
    this._setMemory(contentHash, data, timestamp, ttlMs);

    // Set storage.local
    try {
      await this._setToStorage(contentHash, data, timestamp, ttlMs);
    } catch (error) {
      console.warn('[SlopGuard Cache] Storage write error:', error);
    }
  }

  /**
   * Clear semua cache.
   */
  async clearAll() {
    this._memoryCache.clear();
    return new Promise((resolve) => {
      chrome.storage.local.remove(CACHE.STORAGE_KEY, resolve);
    });
  }

  /**
   * Get cache stats.
   * @returns {Promise<{ memoryEntries: number, storageEntries: number }>}
   */
  async getStats() {
    const storageData = await new Promise((resolve) => {
      chrome.storage.local.get(CACHE.STORAGE_KEY, (result) => {
        resolve(result[CACHE.STORAGE_KEY] || {});
      });
    });

    return {
      memoryEntries: this._memoryCache.size,
      storageEntries: Object.keys(storageData).length,
    };
  }

  // === Private Methods ===

  /**
   * Cek apakah entry sudah expired.
   */
  _isExpired(entry) {
    if (!entry.timestamp || !entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Set ke in-memory LRU cache.
   */
  _setMemory(contentHash, data, timestamp, ttl) {
    // Evict LRU jika penuh
    if (this._memoryCache.size >= this._maxMemoryEntries) {
      const oldestKey = this._memoryCache.keys().next().value;
      this._memoryCache.delete(oldestKey);
    }

    this._memoryCache.set(contentHash, { data, timestamp, ttl });
  }

  /**
   * Get dari chrome.storage.local.
   */
  async _getFromStorage(contentHash) {
    return new Promise((resolve) => {
      chrome.storage.local.get(CACHE.STORAGE_KEY, (result) => {
        const cache = result[CACHE.STORAGE_KEY] || {};
        resolve(cache[contentHash] || null);
      });
    });
  }

  /**
   * Set ke chrome.storage.local.
   */
  async _setToStorage(contentHash, data, timestamp, ttl) {
    return new Promise((resolve) => {
      chrome.storage.local.get(CACHE.STORAGE_KEY, (result) => {
        const cache = result[CACHE.STORAGE_KEY] || {};
        cache[contentHash] = { data, timestamp, ttl };
        chrome.storage.local.set({ [CACHE.STORAGE_KEY]: cache }, resolve);
      });
    });
  }

  /**
   * Remove entry dari chrome.storage.local.
   */
  async _removeFromStorage(contentHash) {
    return new Promise((resolve) => {
      chrome.storage.local.get(CACHE.STORAGE_KEY, (result) => {
        const cache = result[CACHE.STORAGE_KEY] || {};
        delete cache[contentHash];
        chrome.storage.local.set({ [CACHE.STORAGE_KEY]: cache }, resolve);
      });
    });
  }
}
