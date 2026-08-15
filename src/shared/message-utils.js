/**
 * SlopGuard — Message Utilities
 * Helper functions untuk konstruksi dan validasi pesan antar-komponen.
 */

/**
 * Generate UUID v4 untuk request ID.
 * Menggunakan crypto.randomUUID jika tersedia, fallback ke implementasi manual.
 * @returns {string}
 */
export function generateRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback untuk environment yang tidak support crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build message object standar untuk komunikasi antar-komponen.
 * @param {string} type - Message type dari MSG enum
 * @param {object} payload - Data payload
 * @returns {object}
 */
export function buildMessage(type, payload = {}) {
  return {
    type,
    requestId: generateRequestId(),
    payload,
  };
}

/**
 * Validasi bahwa response dari LLM memiliki field yang diperlukan untuk skor elemen.
 * @param {object} data - Parsed JSON dari LLM
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateElementScore(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response bukan objek valid' };
  }

  const score = data.elementScore || data;

  if (typeof score.aiProbability !== 'number' || score.aiProbability < 0 || score.aiProbability > 100) {
    return { valid: false, error: 'aiProbability harus angka 0-100' };
  }

  if (!score.statusLabel || !['original', 'needs_review', 'high_slop'].includes(score.statusLabel)) {
    return { valid: false, error: 'statusLabel tidak valid' };
  }

  if (!Array.isArray(score.flaggedPhrases)) {
    return { valid: false, error: 'flaggedPhrases harus berupa array' };
  }

  return { valid: true };
}

/**
 * Send message ke service worker dan return Promise dengan response.
 * @param {string} type - Message type
 * @param {object} payload - Data payload
 * @returns {Promise<object>}
 */
export function sendToBackground(type, payload = {}) {
  return new Promise((resolve, reject) => {
    const message = buildMessage(type, payload);
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Send message ke content script di tab tertentu.
 * @param {number} tabId - Tab ID
 * @param {string} type - Message type
 * @param {object} payload - Data payload
 * @returns {Promise<object>}
 */
export function sendToTab(tabId, type, payload = {}) {
  return new Promise((resolve, reject) => {
    const message = buildMessage(type, payload);
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}
