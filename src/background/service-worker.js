/**
 * SlopGuard — Service Worker (Background Script)
 * Pusat orkestrasi: message routing, API calls, cache management, context menu.
 */

import { MSG, BADGE_COLORS, STATUS, ANALYSIS_MODE } from '../shared/constants.js';
import { loadSettings } from '../shared/settings-manager.js';
import { CacheManager } from './cache-manager.js';
import { createProvider } from './llm-provider.js';
import { buildScorePrompt, buildFullPrompt, buildFullPagePrompt, buildDesignPrompt } from './prompt-builder.js';

const cacheManager = new CacheManager();

// === Initialization ===

chrome.runtime.onInstalled.addListener(() => {
  // Register context menu
  chrome.contextMenus.create({
    id: 'slopguard-audit-selection',
    title: 'SlopGuard: Audit Seleksi Ini',
    contexts: ['selection'],
  });

  console.log('[SlopGuard] Extension installed, context menu registered.');
});

// === Message Handler ===

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error(`[SlopGuard] Error handling ${message.type}:`, error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate async response
  return true;
});

/**
 * Route message ke handler yang sesuai.
 */
async function handleMessage(message, sender) {
  const { type, payload, requestId } = message;

  switch (type) {
    case MSG.ANALYZE_ELEMENT:
      return handleAnalyzeElement(payload, requestId);

    case MSG.ANALYZE_SELECTION:
      return handleAnalyzeElement(payload, requestId);

    case MSG.REQUEST_REWRITE:
      return handleRequestRewrite(payload, requestId);

    case MSG.ANALYZE_FULL_PAGE:
      return handleAnalyzeFullPage(payload, requestId);

    case MSG.ANALYZE_DESIGN:
      return handleAnalyzeDesign(message, sender);

    case MSG.TEST_CONNECTION:
      return handleTestConnection(payload);

    case MSG.CLEAR_CACHE:
      return handleClearCache();

    case MSG.GET_TAB_STATE:
      return handleGetTabState(payload);

    case MSG.UPDATE_BADGE:
      return handleUpdateBadge(payload, sender);

    default:
      return { success: false, error: `Unknown message type: ${type}` };
  }
}

// === Analysis Handlers ===

/**
 * Analisis elemen tunggal (Inspector Mode / Context Menu Selection).
 */
async function handleAnalyzeElement(payload, requestId) {
  const { text, contentHash, mode = ANALYSIS_MODE.SCORE_ONLY } = payload;

  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Teks kosong' };
  }

  // 1. Cek cache
  const cached = await cacheManager.get(contentHash);
  if (cached) {
    return {
      success: true,
      requestId,
      data: cached,
      fromCache: true,
    };
  }

  // 2. Build prompt & call LLM
  const settings = await loadSettings();

  const apiKey = settings.apiKeys?.[settings.provider] || settings.apiKey;
  if (!apiKey && settings.provider !== 'ollama') {
    return { success: false, error: 'API key belum dikonfigurasi.' };
  }

  const provider = createProvider(settings);
  const prompt = mode === ANALYSIS_MODE.FULL
    ? buildFullPrompt(text)
    : buildScorePrompt(text);

  try {
    const result = await provider.analyze(prompt);

    // 3. Cache result
    await cacheManager.set(contentHash, result, settings.cacheTtlMs);

    return {
      success: true,
      requestId,
      data: result,
      fromCache: false,
    };
  } catch (error) {
    return {
      success: false,
      requestId,
      error: error.message,
    };
  }
}

/**
 * Request rewrite suggestion (lazy-loaded, on-demand).
 */
async function handleRequestRewrite(payload, requestId) {
  const { text } = payload;

  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Teks kosong' };
  }

  const settings = await loadSettings();

  const apiKey = settings.apiKeys?.[settings.provider] || settings.apiKey;
  if (!apiKey && settings.provider !== 'ollama') {
    return { success: false, error: 'API key belum dikonfigurasi.' };
  }

  const provider = createProvider(settings);
  const prompt = buildFullPrompt(text);

  try {
    const result = await provider.analyze(prompt);
    return {
      success: true,
      requestId,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      requestId,
      error: error.message,
    };
  }
}

// === Utility Handlers ===

/**
 * Test koneksi ke LLM provider.
 */
async function handleTestConnection(payload) {
  const { apiKey, provider: providerName, model, customEndpoint } = payload;

  const settings = {
    apiKey,
    provider: providerName,
    model,
    customEndpoint,
  };

  const provider = createProvider(settings);

  try {
    const result = await provider.testConnection();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Clear semua cache.
 */
async function handleClearCache() {
  await cacheManager.clearAll();
  return { success: true };
}

/**
 * Get state untuk tab tertentu dari session storage.
 */
async function handleGetTabState(payload) {
  const { tabId } = payload;
  return new Promise((resolve) => {
    const key = `slopguard_tab_${tabId}`;
    chrome.storage.session.get(key, (result) => {
      resolve({ success: true, data: result[key] || null });
    });
  });
}

/**
 * Update badge di toolbar icon.
 */
async function handleUpdateBadge(payload, sender) {
  const { score, statusLabel } = payload;
  const tabId = sender?.tab?.id || payload.tabId;

  if (!tabId) return { success: false, error: 'Tab ID tidak ditemukan' };

  try {
    if (score !== null && score !== undefined) {
      await chrome.action.setBadgeText({ text: `${score}`, tabId });
      const color = BADGE_COLORS[statusLabel] || '#525252';
      await chrome.action.setBadgeBackgroundColor({ color, tabId });
    } else {
      await chrome.action.setBadgeText({ text: '', tabId });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Analisis seluruh halaman (Active Page Audit).
 */
async function handleAnalyzeFullPage(payload, requestId) {
  const { text, url } = payload;

  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Teks halaman kosong' };
  }

  // 1. Cek pengaturan
  const settings = await loadSettings();
  const apiKey = settings.apiKeys?.[settings.provider] || settings.apiKey;
  if (!apiKey && settings.provider !== 'ollama') {
    return { success: false, error: 'API Key belum dikonfigurasi. Buka pengaturan.' };
  }

  try {
    const provider = createProvider(settings);
    
    // 2. Build prompt spesifik untuk seluruh halaman
    const prompt = buildFullPagePrompt(text, settings.thresholds);
    
    // 3. Panggil API
    const result = await provider.analyze(prompt);

    return {
      success: true,
      requestId,
      data: result,
      fromCache: false,
    };
  } catch (error) {
    console.error('[SlopGuard] API Error (Full Page):', error);
    return { success: false, error: error.message };
  }
}

/**
 * Analisis Desain Visual (Multimodal)
 */
async function handleAnalyzeDesign(message, sender) {
  const tabId = message.tabId || sender?.tab?.id;
  if (!tabId) return { success: false, error: 'Tab ID tidak ditemukan' };

  try {
    // 1. Tampilkan loading di sidebar
    chrome.tabs.sendMessage(tabId, { type: MSG.SHOW_SIDEBAR_LOADING });

    // 2. Ambil screenshot
    const dataUrl = await new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 50 }, (data) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(data);
      });
    });

    if (!dataUrl) throw new Error('Gagal mengambil screenshot');

    // 3. Siapkan API
    const settings = await loadSettings();
    const apiKey = settings.apiKeys?.[settings.provider] || settings.apiKey;
    if (!apiKey && settings.provider !== 'ollama') throw new Error('API Key belum dikonfigurasi.');

    const provider = createProvider(settings);
    
    // Gunakan prompt khusus desain
    // Kita buat buildDesignPrompt menerima base64 (tanpa header data:image/jpeg;base64,)
    const base64Image = dataUrl.split(',')[1];
    const prompt = buildDesignPrompt(base64Image, settings.thresholds);
    
    // 4. Panggil API (Provider harus dimodifikasi untuk mendukung prompt.image)
    const result = await provider.analyze(prompt);

    // 5. Kirim hasil kembali ke tab untuk ditampilkan di sidebar
    chrome.tabs.sendMessage(tabId, { type: MSG.SHOW_SIDEBAR_RESULT, data: result });
    
    return { success: true };
  } catch (error) {
    console.error('[SlopGuard] Design Audit Error:', error);
    chrome.tabs.sendMessage(tabId, { type: MSG.SHOW_SIDEBAR_ERROR, error: error.message });
    return { success: false, error: error.message };
  }
}

// === Context Menu Handler ===

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'slopguard-audit-selection' && info.selectionText) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: MSG.ANALYZE_SELECTION,
        requestId: crypto.randomUUID(),
        payload: {
          text: info.selectionText,
          source: 'context_menu',
        },
      });
    } catch (error) {
      console.error('[SlopGuard] Failed to send selection to content script:', error);
    }
  }
});

// === Keyboard Shortcut Handler ===

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-inspector') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: MSG.TOGGLE_INSPECTOR,
          requestId: crypto.randomUUID(),
          payload: {},
        });
      } catch (error) {
        console.error('[SlopGuard] Failed to toggle inspector:', error);
      }
    }
  }
});
