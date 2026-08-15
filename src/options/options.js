/**
 * SlopGuard — Options Page Script
 * Load/save settings, test connection, cache management.
 */

import { MSG, DEFAULT_SETTINGS } from '../shared/constants.js';
import { loadSettings, saveSettings } from '../shared/settings-manager.js';
import { sendToBackground } from '../shared/message-utils.js';

// === DOM References ===
const providerSelect = document.getElementById('providerSelect');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleKeyVisibility = document.getElementById('toggleKeyVisibility');
const modelInput = document.getElementById('modelInput');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const connectionStatus = document.getElementById('connectionStatus');
const thresholdLow = document.getElementById('thresholdLow');
const thresholdMedium = document.getElementById('thresholdMedium');
const thresholdLowValue = document.getElementById('thresholdLowValue');
const thresholdLowPlus = document.getElementById('thresholdLowPlus');
const thresholdMediumValue = document.getElementById('thresholdMediumValue');
const thresholdHighStart = document.getElementById('thresholdHighStart');
const cacheTtlSelect = document.getElementById('cacheTtlSelect');
const clearCacheBtn = document.getElementById('clearCacheBtn');
const cacheInfo = document.getElementById('cacheInfo');
const blacklistInput = document.getElementById('blacklistInput');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

// === Initialization ===

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentSettings();
  setupEventListeners();
});

let currentApiKeys = {};
let previousProvider = '';

// === Load Settings ===

async function loadCurrentSettings() {
  try {
    const settings = await loadSettings();

    // Provider
    providerSelect.value = settings.provider || 'gemini';
    previousProvider = providerSelect.value;

    // API Keys
    currentApiKeys = settings.apiKeys || {
      gemini: '',
      groq: '',
      ollama: 'http://localhost:11434'
    };
    apiKeyInput.value = currentApiKeys[providerSelect.value] || '';
    updateProviderUI(providerSelect.value);

    // Model
    modelInput.value = settings.model || 'gemini-3.7-flash';

    // Thresholds
    thresholdLow.value = settings.thresholds?.low ?? 30;
    thresholdMedium.value = settings.thresholds?.medium ?? 65;
    updateThresholdDisplay();

    // Cache TTL
    cacheTtlSelect.value = (settings.cacheTtlMs ?? 604800000).toString();

    // Domain blacklist
    blacklistInput.value = (settings.domainList?.blacklist || []).join('\n');

  } catch (error) {
    console.error('[SlopGuard Options] Error loading settings:', error);
  }
}

// === Event Listeners ===

function setupEventListeners() {
  // Toggle API key visibility
  toggleKeyVisibility.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyVisibility.title = isPassword ? 'Sembunyikan key' : 'Tampilkan key';
  });

  // Test connection
  testConnectionBtn.addEventListener('click', handleTestConnection);

  // Provider change
  providerSelect.addEventListener('change', () => {
    // Simpan API key yang diketik ke memori sebelum ganti
    currentApiKeys[previousProvider] = apiKeyInput.value.trim();
    
    const newProvider = providerSelect.value;
    previousProvider = newProvider;
    
    // Set API key dari memori ke input
    apiKeyInput.value = currentApiKeys[newProvider] || '';
    
    if (newProvider === 'groq') {
      modelInput.value = 'llama-3.1-8b-instant';
      modelInput.placeholder = 'llama-3.1-8b-instant';
    } else if (newProvider === 'gemini') {
      modelInput.value = 'gemini-3.7-flash';
      modelInput.placeholder = 'gemini-3.7-flash';
    } else if (newProvider === 'ollama') {
      modelInput.value = 'llama3';
      modelInput.placeholder = 'llama3';
    }
    
    updateProviderUI(newProvider);
  });

  // Threshold sliders
  thresholdLow.addEventListener('input', () => {
    // Ensure low < medium
    const lowVal = parseInt(thresholdLow.value);
    const medVal = parseInt(thresholdMedium.value);
    if (lowVal >= medVal) {
      thresholdMedium.value = lowVal + 5;
    }
    updateThresholdDisplay();
  });

  thresholdMedium.addEventListener('input', () => {
    // Ensure medium > low
    const lowVal = parseInt(thresholdLow.value);
    const medVal = parseInt(thresholdMedium.value);
    if (medVal <= lowVal) {
      thresholdLow.value = medVal - 5;
    }
    updateThresholdDisplay();
  });

  // Clear cache
  clearCacheBtn.addEventListener('click', handleClearCache);

  // Save
  saveBtn.addEventListener('click', handleSave);
}

// === UI Helpers ===

function updateProviderUI(provider) {
  const apiKeyHint = document.getElementById('apiKeyHint');
  const apiKeyLabel = document.getElementById('apiKeyLabel');
  
  if (provider === 'gemini') {
    apiKeyLabel.textContent = 'API Key';
    apiKeyHint.innerHTML = 'Dapatkan API key dari <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a>.';
  } else if (provider === 'groq') {
    apiKeyLabel.textContent = 'API Key';
    apiKeyHint.innerHTML = 'Dapatkan API key dari <a href="https://console.groq.com/keys" target="_blank" rel="noopener">Groq Console</a>.';
  } else if (provider === 'ollama') {
    apiKeyLabel.textContent = 'Endpoint URL';
    apiKeyHint.innerHTML = 'Pastikan Ollama berjalan di komputer Anda. Default: <code>http://localhost:11434</code>';
  }
}

// === Handlers ===

async function handleTestConnection() {
  const apiKey = apiKeyInput.value.trim();
  const provider = providerSelect.value;
  const model = modelInput.value.trim();

  if (!apiKey) {
    showConnectionStatus('Masukkan API key terlebih dahulu', 'error');
    return;
  }

  testConnectionBtn.disabled = true;
  showConnectionStatus('Menguji koneksi...', 'loading');

  try {
    const response = await sendToBackground(MSG.TEST_CONNECTION, {
      apiKey,
      provider,
      model,
    });

    if (response.success) {
      showConnectionStatus(response.data?.message || 'Koneksi berhasil!', 'success');
    } else {
      showConnectionStatus(response.error || 'Koneksi gagal', 'error');
    }
  } catch (error) {
    showConnectionStatus(error.message || 'Gagal menguji koneksi', 'error');
  } finally {
    testConnectionBtn.disabled = false;
  }
}

async function handleClearCache() {
  clearCacheBtn.disabled = true;

  try {
    const response = await sendToBackground(MSG.CLEAR_CACHE);
    if (response.success) {
      cacheInfo.textContent = 'Cache berhasil dihapus';
      cacheInfo.className = 'sg-cache-info sg-text-success';
    } else {
      cacheInfo.textContent = 'Gagal menghapus cache';
      cacheInfo.className = 'sg-cache-info sg-text-error';
    }
  } catch (error) {
    cacheInfo.textContent = error.message;
    cacheInfo.className = 'sg-cache-info sg-text-error';
  } finally {
    clearCacheBtn.disabled = false;
    setTimeout(() => {
      cacheInfo.textContent = '';
      cacheInfo.className = 'sg-cache-info';
    }, 3000);
  }
}

async function handleSave() {
  saveBtn.disabled = true;
  showSaveStatus('Menyimpan...', 'loading');

  // Simpan input terakhir ke memori
  currentApiKeys[providerSelect.value] = apiKeyInput.value.trim();

  const blacklistText = blacklistInput.value.trim();
  const blacklist = blacklistText
    ? blacklistText.split('\n').map((d) => d.trim()).filter(Boolean)
    : [];

  const updates = {
    provider: providerSelect.value,
    apiKeys: currentApiKeys,
    model: modelInput.value.trim(),
    thresholds: {
      low: parseInt(thresholdLow.value, 10),
      medium: parseInt(thresholdMedium.value, 10),
    },
    cacheTtlMs: parseInt(cacheTtlSelect.value, 10),
    domainList: { blacklist },
  };

  try {
    await saveSettings(updates);
    
    // Clear cache because settings changed
    chrome.runtime.sendMessage({ type: MSG.CLEAR_CACHE });

    showSaveStatus('Pengaturan berhasil disimpan!', 'success');
  } catch (error) {
    console.error('[SlopGuard] Save Error:', error);
    showSaveStatus('Gagal menyimpan pengaturan.', 'error');
  } finally {
    setTimeout(() => {
      saveBtn.disabled = false;
      showSaveStatus('', '');
    }, 2000);
  }
}

// === UI Helpers ===

function updateThresholdDisplay() {
  const lowVal = parseInt(thresholdLow.value);
  const medVal = parseInt(thresholdMedium.value);

  thresholdLowValue.textContent = lowVal;
  thresholdLowPlus.textContent = lowVal + 1;
  thresholdMediumValue.textContent = medVal;
  thresholdHighStart.textContent = medVal + 1;

  // Update slider visual fill
  updateSliderFill(thresholdLow, '#22C55E');
  updateSliderFill(thresholdMedium, '#EAB308');
}

function updateSliderFill(slider, color) {
  const min = parseInt(slider.min);
  const max = parseInt(slider.max);
  const val = parseInt(slider.value);
  const percent = ((val - min) / (max - min)) * 100;
  slider.style.setProperty('--fill-percent', `${percent}%`);
  slider.style.setProperty('--fill-color', color);
}

function showConnectionStatus(text, type) {
  connectionStatus.textContent = text;
  connectionStatus.className = `sg-connection-status sg-text-${type}`;
}

function showSaveStatus(text, type) {
  saveStatus.textContent = text;
  saveStatus.className = `sg-save-status sg-text-${type}`;
}
