/**
 * SlopGuard — Content Script (Entry Point)
 * Inject Shadow DOM container, manage Inspector Mode, handle hover detection.
 */

import { MSG, INSPECTOR, ANALYSIS_MODE } from '../shared/constants.js';
import { sendToBackground, generateRequestId } from '../shared/message-utils.js';
import { isTextElement, isBoilerplate, isVisible, getTextContent, meetsMinLength, hashText, extractFullPageText, chunkText } from './text-utils.js';
import { InspectorUI } from './inspector-ui.js';
import { SidebarUI } from './sidebar-ui.js';
import contentCSS from './content.css?inline';

// === State ===
let inspectorActive = false;
let inspectorUI = null;
let sidebarUI = null;
let shadowRoot = null;
let debounceTimer = null;
let throttleTimer = null;
let lastHoveredElement = null;
let currentTabId = null;

// === Initialization ===

function init() {
  createShadowContainer();
  setupMessageListener();
  console.log('[SlopGuard] Content script initialized.');
}

/**
 * Create Shadow DOM container yang terisolasi dari halaman host.
 */
function createShadowContainer() {
  const container = document.createElement('div');
  container.id = 'slopguard-root';
  container.setAttribute('style', 'position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;');

  shadowRoot = container.attachShadow({ mode: 'closed' });

  // Inject scoped CSS
  const style = document.createElement('style');
  style.textContent = contentCSS;
  shadowRoot.appendChild(style);

  // Append container ke body
  document.body.appendChild(container);

  // Initialize UIs
  inspectorUI = new InspectorUI(shadowRoot);
  sidebarUI = new SidebarUI(shadowRoot);
}

// === Message Listener ===

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return false;

    switch (message.type) {
      case MSG.TOGGLE_INSPECTOR:
        toggleInspector();
        sendResponse({ success: true, active: inspectorActive });
        break;

      case MSG.ANALYZE_FULL_PAGE:
        performFullPageAudit();
        sendResponse({ success: true, active: true });
        break;

      case MSG.CHECK_INSPECTOR_STATUS:
        setInspectorState(message.payload?.active ?? false);
        sendResponse({ success: true, active: inspectorActive });
        break;

      case MSG.SHOW_SIDEBAR_LOADING:
        sidebarUI.showLoading();
        sendResponse({ success: true });
        break;

      case MSG.SHOW_SIDEBAR_RESULT:
        sidebarUI.showResult(message.data);
        sendResponse({ success: true });
        break;

      case MSG.SHOW_SIDEBAR_ERROR:
        sidebarUI.showError(message.error, () => sidebarUI.hide());
        sendResponse({ success: true });
        break;

      case MSG.GET_INSPECTOR_STATE:
        sendResponse({ success: true, active: inspectorActive });
        return false;

      case MSG.ANALYZE_SELECTION:
        handleSelectionAnalysis(message.payload);
        sendResponse({ success: true });
        return false;

      default:
        return false;
    }
  });
}

// === Inspector Mode Control ===

function toggleInspector() {
  setInspectorState(!inspectorActive);
}

function setInspectorState(active) {
  inspectorActive = active;

  if (active) {
    enableInspector();
  } else {
    disableInspector();
  }

  // Persist state per-tab
  saveTabState();
}

function enableInspector() {
  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('mouseleave', onMouseLeave, { passive: true });
  document.documentElement.style.setProperty('cursor', 'crosshair', 'important');
  console.log('[SlopGuard] Inspector Mode activated.');
}

function disableInspector() {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseleave', onMouseLeave);
  document.documentElement.style.removeProperty('cursor');

  clearTimeout(debounceTimer);
  clearTimeout(throttleTimer);
  lastHoveredElement = null;

  if (inspectorUI) {
    inspectorUI.hide();
    inspectorUI.hideHighlight();
  }

  console.log('[SlopGuard] Inspector Mode deactivated.');
}

// === Hover Detection (Event Delegation with Throttle + Debounce) ===

function onMouseMove(e) {
  if (!inspectorActive) return;

  // Throttle mousemove
  if (throttleTimer) return;

  throttleTimer = setTimeout(() => {
    throttleTimer = null;
  }, INSPECTOR.THROTTLE_MS);

  const target = findTextElement(e.target);

  if (!target || target === lastHoveredElement) return;

  lastHoveredElement = target;

  // Show highlight
  if (inspectorUI) {
    inspectorUI.showHighlight(target);
  }

  // Debounce before triggering analysis
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerAnalysis(target, e.clientX, e.clientY);
  }, INSPECTOR.DEBOUNCE_MS);
}

function onMouseLeave() {
  clearTimeout(debounceTimer);
  lastHoveredElement = null;

  if (inspectorUI) {
    inspectorUI.hide();
    inspectorUI.hideHighlight();
  }
}

/**
 * Walk up DOM tree untuk find nearest valid text element.
 * @param {HTMLElement} el
 * @returns {HTMLElement|null}
 */
function findTextElement(el) {
  let current = el;
  let depth = 0;
  const maxDepth = 5;

  while (current && current !== document.body && depth < maxDepth) {
    if (
      isTextElement(current) &&
      isVisible(current) &&
      !isBoilerplate(current) &&
      meetsMinLength(getTextContent(current))
    ) {
      return current;
    }
    current = current.parentElement;
    depth++;
  }

  return null;
}

// === Analysis Trigger ===

async function triggerAnalysis(element, cursorX, cursorY) {
  const text = getTextContent(element);

  if (!text || !meetsMinLength(text)) return;

  // Generate content hash
  const contentHash = await hashText(text);

  // Cek apakah sudah di-dismiss
  if (inspectorUI && inspectorUI.isDismissed(contentHash)) return;

  // Tag element dengan hash untuk dismiss tracking
  element._sgHash = contentHash;

  const requestId = generateRequestId();

  // Show loading modal
  if (inspectorUI) {
    inspectorUI.showLoading(cursorX, cursorY, requestId);
  }

  try {
    const response = await sendToBackground(MSG.ANALYZE_ELEMENT, {
      text,
      contentHash,
      mode: ANALYSIS_MODE.SCORE_ONLY,
      url: window.location.href,
    });

    if (response.success) {
      if (inspectorUI) {
        inspectorUI.showResult(response.data, requestId, element, text);
      }

      // Update badge
      sendToBackground(MSG.UPDATE_BADGE, {
        score: response.data.aiProbability,
        statusLabel: response.data.statusLabel,
      }).catch(() => {}); // Non-critical
    } else {
      if (inspectorUI) {
        inspectorUI.showError(
          response.error || 'Terjadi kesalahan',
          requestId,
          () => triggerAnalysis(element, cursorX, cursorY)
        );
      }
    }
  } catch (error) {
    if (inspectorUI) {
      inspectorUI.showError(
        error.message || 'Gagal menghubungi service worker',
        requestId,
        () => triggerAnalysis(element, cursorX, cursorY)
      );
    }
  }
}

// === Context Menu Selection Analysis ===

async function handleSelectionAnalysis(payload) {
  const { text, source } = payload;

  if (!text || text.trim().length < 5) return;

  const contentHash = await hashText(text);
  const requestId = generateRequestId();

  // Position modal di center viewport
  const centerX = window.innerWidth / 2 - INSPECTOR.MODAL_WIDTH / 2;
  const centerY = window.innerHeight / 3;

  if (inspectorUI) {
    inspectorUI.showLoading(centerX, centerY, requestId);
  }

  try {
    const response = await sendToBackground(MSG.ANALYZE_ELEMENT, {
      text,
      contentHash,
      mode: ANALYSIS_MODE.SCORE_ONLY,
      url: window.location.href,
    });

    if (response.success) {
      if (inspectorUI) {
        inspectorUI.showResult(response.data, requestId, null, text);
      }
    } else {
      if (inspectorUI) {
        inspectorUI.showError(
          response.error || 'Terjadi kesalahan',
          requestId,
          () => handleSelectionAnalysis(payload)
        );
      }
    }
  } catch (error) {
    if (inspectorUI) {
      inspectorUI.showError(
        error.message,
        requestId,
        () => handleSelectionAnalysis(payload)
      );
    }
  }
}

// === State Persistence ===

function saveTabState() {
  chrome.storage.session.set({
    [`slopguard_tab_state`]: {
      inspectorActive,
      url: window.location.href,
      updatedAt: Date.now(),
    },
  }).catch(() => {});
}

function restoreTabState() {
  chrome.storage.session.get('slopguard_tab_state', (result) => {
    const state = result['slopguard_tab_state'];
    if (state && state.inspectorActive) {
      setInspectorState(true);
    }
  });
}

// === Full Page Audit ===

async function performFullPageAudit() {
  console.log('[SlopGuard] Memulai Active Page Audit...');
  sidebarUI.showLoading();

  try {
    // 1. Ekstrak teks
    const texts = extractFullPageText();
    if (texts.length === 0) {
      sidebarUI.showError('Tidak dapat menemukan konten teks yang cukup panjang di halaman ini.', () => sidebarUI.hide());
      return;
    }

    // 2. Potong menjadi chunks (di versi ini kita kirim 1 chunk gabungan)
    const chunks = chunkText(texts);
    const combinedText = chunks.join('\n\n');

    // 3. Kirim ke background
    const requestId = generateRequestId();
    
    // Nonaktifkan inspector hover sementara audit halaman berjalan
    const wasInspectorActive = inspectorActive;
    if (inspectorActive) toggleInspector();

    const response = await sendToBackground(MSG.ANALYZE_FULL_PAGE, {
      text: combinedText,
      url: window.location.href,
      mode: ANALYSIS_MODE.ACTIVE_PAGE
    });

    if (response && response.success) {
      sidebarUI.showResult(response.data);
    } else {
      sidebarUI.showError(response?.error || 'Gagal terhubung ke API.', () => performFullPageAudit());
    }

    if (wasInspectorActive && !inspectorActive) {
      toggleInspector();
    }
  } catch (error) {
    console.error('[SlopGuard] Page Audit Error:', error);
    sidebarUI.showError('Terjadi kesalahan tidak terduga.', () => performFullPageAudit());
  }
}

// === Cleanup ===

window.addEventListener('beforeunload', () => {
  if (inspectorUI) {
    inspectorUI.destroy();
  }
  disableInspector();
});

// === Start ===

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    restoreTabState();
  });
} else {
  init();
  restoreTabState();
}
