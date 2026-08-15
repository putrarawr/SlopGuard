/**
 * SlopGuard — Settings Manager
 * Load, save, dan validasi konfigurasi pengguna dari chrome.storage.local.
 */

import { CACHE, DEFAULT_SETTINGS, STATUS } from './constants.js';

/**
 * Load settings dari chrome.storage.local, merge dengan defaults.
 * @returns {Promise<object>}
 */
export async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(CACHE.SETTINGS_KEY, (result) => {
      const stored = result[CACHE.SETTINGS_KEY] || {};
      
      // MIGRATION: Pindahkan apiKey tunggal ke struktur apiKeys yang baru
      if (stored.apiKey !== undefined && stored.provider) {
        if (!stored.apiKeys) {
          stored.apiKeys = {
            gemini: '',
            groq: '',
            ollama: 'http://localhost:11434'
          };
        }
        stored.apiKeys[stored.provider] = stored.apiKey;
        delete stored.apiKey;
      }
      
      // MIGRATION: Hapus model Groq Vision karena sudah decommissioned
      if (stored.model && stored.model.includes('vision') && stored.provider === 'groq') {
        stored.model = 'llama-3.1-8b-instant';
      }
      
      const merged = deepMerge(structuredClone(DEFAULT_SETTINGS), stored);
      resolve(merged);
    });
  });
}

/**
 * Save settings ke chrome.storage.local (merge, bukan overwrite).
 * @param {object} updates - Partial settings object
 * @returns {Promise<void>}
 */
export async function saveSettings(updates) {
  const current = await loadSettings();
  const merged = deepMerge(current, updates);

  return new Promise((resolve) => {
    chrome.storage.local.set({ [CACHE.SETTINGS_KEY]: merged }, resolve);
  });
}

/**
 * Reset settings ke default.
 * @returns {Promise<void>}
 */
export async function resetSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      { [CACHE.SETTINGS_KEY]: structuredClone(DEFAULT_SETTINGS) },
      resolve
    );
  });
}

/**
 * Resolve skor AI probability ke status label berdasarkan user thresholds.
 * @param {number} score - 0-100
 * @param {{ low: number, medium: number }} thresholds
 * @returns {string} - STATUS enum value
 */
export function resolveStatus(score, thresholds) {
  if (score <= thresholds.low) return STATUS.ORIGINAL;
  if (score <= thresholds.medium) return STATUS.NEEDS_REVIEW;
  return STATUS.HIGH_SLOP;
}

/**
 * Validasi settings object.
 * @param {object} settings
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSettings(settings) {
  const errors = [];

  if (settings.provider && !['gemini', 'groq', 'ollama'].includes(settings.provider)) {
    errors.push('Provider tidak valid');
  }

  if (settings.thresholds) {
    const { low, medium } = settings.thresholds;
    if (typeof low !== 'number' || low < 0 || low > 100) {
      errors.push('Threshold low harus angka 0-100');
    }
    if (typeof medium !== 'number' || medium < 0 || medium > 100) {
      errors.push('Threshold medium harus angka 0-100');
    }
    if (low >= medium) {
      errors.push('Threshold low harus lebih kecil dari medium');
    }
  }

  if (settings.cacheTtlMs && (typeof settings.cacheTtlMs !== 'number' || settings.cacheTtlMs < 0)) {
    errors.push('Cache TTL harus angka positif');
  }

  return { valid: errors.length === 0, errors };
}

// === Private Helpers ===

/**
 * Deep merge dua object. Source overrides target.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
