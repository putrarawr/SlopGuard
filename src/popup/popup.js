/**
 * SlopGuard — Popup Script
 * Kontrol Inspector Mode, tampilkan status, ringkasan audit terakhir.
 */

import { MSG, STATUS_LABEL_TEXT, STATUS_COLORS } from '../shared/constants.js';
import { loadSettings, saveSettings } from '../shared/settings-manager.js';

// === DOM References ===
const inspectorToggle = document.getElementById('inspectorToggle');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statusBadge = document.getElementById('statusBadge');
const settingsLink = document.getElementById('settingsLink');
const summarySection = document.getElementById('summarySection');
const summaryCard = document.getElementById('summaryCard');
const summaryUrl = document.getElementById('summaryUrl');
const summaryScore = document.getElementById('summaryScore');
const summaryBadge = document.getElementById('summaryBadge');
const summaryTime = document.getElementById('summaryTime');
const quickModelSelect = document.getElementById('quickModelSelect');

// === Initialization ===

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentState();
  setupEventListeners();
});

// === State Loading ===

async function loadCurrentState() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Get inspector state from content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: MSG.GET_INSPECTOR_STATE,
        requestId: crypto.randomUUID(),
        payload: {},
      });

      if (response?.success) {
        updateToggleUI(response.active);
      }
    } catch {
      // Content script mungkin belum loaded
      updateToggleUI(false);
    }

    // Load last audit summary from session storage
    loadLastSummary();

    // Set quickModelSelect based on settings
    const settings = await loadSettings();
    const selectValue = `${settings.provider}|${settings.model}`;
    
    let optionExists = false;
    for (const option of quickModelSelect.options) {
      if (option.value === selectValue) {
        optionExists = true;
        break;
      }
    }
    
    if (!optionExists && settings.model) {
      const customOpt = document.createElement('option');
      customOpt.value = selectValue;
      customOpt.text = `Custom (${settings.model})`;
      quickModelSelect.appendChild(customOpt);
    }
    
    quickModelSelect.value = selectValue;
  } catch (error) {
    console.error('[SlopGuard Popup] Error loading state:', error);
  }
}

async function loadLastSummary() {
  try {
    const result = await chrome.storage.session.get('slopguard_last_audit');
    const lastAudit = result['slopguard_last_audit'];

    if (lastAudit) {
      showSummary(lastAudit);
    }
  } catch {
    // No summary available
  }
}

// === Event Listeners ===

function setupEventListeners() {
  // Inspector toggle
  inspectorToggle.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: MSG.TOGGLE_INSPECTOR,
        requestId: crypto.randomUUID(),
        payload: {},
      });

      if (response?.success) {
        updateToggleUI(response.active);
      }
    } catch (error) {
      console.error('[SlopGuard Popup] Toggle error:', error);
      // Mungkin content script belum loaded di halaman ini
      updateToggleUI(false);
      showTempMessage('Tidak dapat mengaktifkan di halaman ini');
    }
  });

  // Handle Quick Model Select
  quickModelSelect.addEventListener('change', async () => {
    const [provider, model] = quickModelSelect.value.split('|');
    const settings = await loadSettings();
    settings.provider = provider;
    settings.model = model;
    await saveSettings(settings);

    // Clear cache because model changed
    chrome.runtime.sendMessage({ type: MSG.CLEAR_CACHE });
    console.log(`[SlopGuard] Model changed to ${provider} / ${model}`);
  });

  auditPageBtn.addEventListener('click', async () => {
    // Check if on a valid page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      alert('Tidak dapat menjalankan audit di halaman ini.');
      return;
    }

    try {
      // Inject content script just in case it's not loaded
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(() => {}); // ignore error if already injected

      // Send trigger message
      chrome.tabs.sendMessage(tab.id, { type: MSG.ANALYZE_FULL_PAGE }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[SlopGuard] Reloading page to inject script...');
          alert('Mohon refresh (F5) halaman web ini terlebih dahulu agar ekstensi dapat dimuat.');
        } else {
          window.close(); // Close popup when audit starts
        }
      });
    } catch (e) {
      console.error(e);
    }
  });

  // Audit Design (Visual)
  auditSiteBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      alert('Tidak dapat mengambil screenshot di halaman ini.');
      return;
    }

    try {
      // Inject content script just in case it's not loaded
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(() => {}); // ignore error if already injected

      // Send trigger message ke background script (bukan content script!)
      // Karena background script yg punya akses chrome.tabs.captureVisibleTab
      chrome.runtime.sendMessage({ type: 'ANALYZE_DESIGN', tabId: tab.id }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[SlopGuard]', chrome.runtime.lastError);
        }
      });
      window.close(); // Tutup popup agar screenshot bersih
    } catch (e) {
      console.error(e);
    }
  });

  // Settings link
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

// === UI Updates ===

function updateToggleUI(active) {
  inspectorToggle.setAttribute('aria-checked', active.toString());
  inspectorToggle.classList.toggle('sg-toggle-active', active);

  statusDot.className = `sg-status-dot ${active ? 'sg-dot-active' : ''}`;
  statusText.textContent = active ? 'Aktif' : 'Nonaktif';
  statusBadge.className = `sg-status-badge ${active ? 'sg-badge-active' : ''}`;
}

function showSummary(data) {
  const { url, score, statusLabel, timestamp } = data;

  summarySection.style.display = 'block';

  // URL (truncated)
  const displayUrl = url.length > 40 ? url.substring(0, 37) + '...' : url;
  summaryUrl.textContent = displayUrl;
  summaryUrl.title = url;

  // Score
  const color = STATUS_COLORS[statusLabel] || '#525252';
  summaryScore.textContent = `Skor: ${score}%`;
  summaryScore.style.color = color;

  // Badge
  const labelText = STATUS_LABEL_TEXT[statusLabel] || statusLabel;
  summaryBadge.textContent = labelText;
  summaryBadge.style.color = color;
  summaryBadge.style.borderColor = color;

  // Time
  if (timestamp) {
    const ago = getTimeAgo(timestamp);
    summaryTime.textContent = `Diaudit ${ago}`;
  }
}

function showTempMessage(text) {
  const existing = document.querySelector('.sg-temp-message');
  if (existing) existing.remove();

  const msg = document.createElement('div');
  msg.className = 'sg-temp-message';
  msg.textContent = text;
  document.querySelector('.sg-popup').appendChild(msg);

  setTimeout(() => msg.remove(), 3000);
}

// === Utilities ===

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}
