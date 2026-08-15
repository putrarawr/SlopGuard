/**
 * SlopGuard — Inspector UI
 * Floating modal component yang dirender di dalam Shadow DOM.
 * Smart positioning, skeleton loading, pin mode, dan rewrite lazy-load.
 */

import { STATUS_LABEL_TEXT, STATUS_COLORS, MSG, INSPECTOR } from '../shared/constants.js';
import { sendToBackground } from '../shared/message-utils.js';

export class InspectorUI {
  /**
   * @param {ShadowRoot} shadowRoot
   */
  constructor(shadowRoot) {
    this._shadow = shadowRoot;
    this._modal = null;
    this._highlightOverlay = null;
    this._isPinned = false;
    this._currentElement = null;
    this._currentRequestId = null;
    this._dismissedHashes = new Set();

    this._createModal();
    this._createHighlightOverlay();
  }

  // === Public Methods ===

  /**
   * Tampilkan highlight outline pada elemen target.
   * @param {HTMLElement} el
   */
  showHighlight(el) {
    if (!el || !this._highlightOverlay) return;

    const rect = el.getBoundingClientRect();
    const overlay = this._highlightOverlay;

    overlay.style.display = 'block';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  /**
   * Sembunyikan highlight overlay.
   */
  hideHighlight() {
    if (this._highlightOverlay) {
      this._highlightOverlay.style.display = 'none';
    }
  }

  /**
   * Tampilkan modal dalam loading state.
   * @param {number} x - Posisi cursor X
   * @param {number} y - Posisi cursor Y
   * @param {string} requestId
   */
  showLoading(x, y, requestId) {
    this._currentRequestId = requestId;
    this._isPinned = false;

    const modal = this._modal;
    modal.innerHTML = this._buildLoadingHTML();
    modal.style.display = 'block';

    this._positionModal(x, y);
    this._attachModalEvents();
  }

  /**
   * Tampilkan hasil analisis di modal.
   * @param {object} data - { aiProbability, statusLabel, flaggedPhrases, rewriteSuggestion }
   * @param {string} requestId
   * @param {HTMLElement} targetElement
   * @param {string} originalText
   */
  showResult(data, requestId, targetElement, originalText) {
    // Ignore stale responses
    if (requestId !== this._currentRequestId) return;

    this._currentElement = targetElement;

    const modal = this._modal;
    modal.innerHTML = this._buildResultHTML(data);
    this._attachModalEvents();
    this._attachResultEvents(data, originalText);
  }

  /**
   * Tampilkan error di modal.
   * @param {string} errorMessage
   * @param {string} requestId
   * @param {function} retryFn
   */
  showError(errorMessage, requestId, retryFn) {
    if (requestId !== this._currentRequestId) return;

    const modal = this._modal;
    modal.innerHTML = this._buildErrorHTML(errorMessage);
    this._attachModalEvents();

    const retryBtn = modal.querySelector('[data-action="retry"]');
    if (retryBtn && retryFn) {
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        retryFn();
      });
    }
  }

  /**
   * Sembunyikan modal (kecuali pinned).
   */
  hide() {
    if (this._isPinned) return;
    this._forceHide();
  }

  /**
   * Force hide modal (bahkan saat pinned).
   */
  _forceHide() {
    if (this._modal) {
      this._modal.style.display = 'none';
      this._modal.innerHTML = '';
    }
    this._isPinned = false;
    this._currentRequestId = null;
    this._currentElement = null;
  }

  /**
   * Cek apakah hash sudah di-dismiss.
   * @param {string} hash
   * @returns {boolean}
   */
  isDismissed(hash) {
    return this._dismissedHashes.has(hash);
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    this._forceHide();
    this.hideHighlight();
    this._dismissedHashes.clear();
  }

  // === Private: DOM Creation ===

  _createModal() {
    this._modal = document.createElement('div');
    this._modal.className = 'sg-modal';
    this._modal.style.display = 'none';
    this._shadow.appendChild(this._modal);
  }

  _createHighlightOverlay() {
    this._highlightOverlay = document.createElement('div');
    this._highlightOverlay.className = 'sg-highlight';
    this._highlightOverlay.style.display = 'none';
    this._shadow.appendChild(this._highlightOverlay);
  }

  // === Private: HTML Builders ===

  _buildLoadingHTML() {
    return `
      <div class="sg-modal-header sg-loading-header">
        <div class="sg-skeleton sg-skeleton-score"></div>
        <div class="sg-skeleton sg-skeleton-label"></div>
      </div>
      <div class="sg-modal-body">
        <div class="sg-skeleton sg-skeleton-line"></div>
        <div class="sg-skeleton sg-skeleton-line sg-skeleton-short"></div>
        <div class="sg-skeleton sg-skeleton-line sg-skeleton-medium"></div>
      </div>
    `;
  }

  _buildResultHTML(data) {
    const { aiProbability, statusLabel, flaggedPhrases, rewriteSuggestion } = data;
    const color = STATUS_COLORS[statusLabel] || '#525252';
    const labelText = STATUS_LABEL_TEXT[statusLabel] || statusLabel;

    const phrasesHTML = flaggedPhrases && flaggedPhrases.length > 0
      ? flaggedPhrases.map(p => `
          <li class="sg-phrase-item">
            <span class="sg-phrase-text">"${this._escapeHTML(p.phrase)}"</span>
            <span class="sg-phrase-reason">${this._escapeHTML(p.reason)}</span>
          </li>
        `).join('')
      : '<li class="sg-phrase-empty">Tidak ada frasa mencurigakan terdeteksi</li>';

    return `
      <div class="sg-modal-header" style="border-left-color: ${color}">
        <div class="sg-score-row">
          <span class="sg-score" style="color: ${color}">${aiProbability}%</span>
          <span class="sg-label">${labelText}</span>
        </div>
        <div class="sg-modal-actions-top">
          <button class="sg-btn-icon" data-action="pin" title="Pin modal" aria-label="Pin modal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v10m0 0l-4-4m4 4l4-4M5 12h14v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4z"/>
            </svg>
          </button>
          <button class="sg-btn-icon" data-action="close" title="Tutup" aria-label="Tutup modal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="sg-modal-body">
        <div class="sg-section">
          <div class="sg-section-title">Frasa Terdeteksi</div>
          <ul class="sg-phrase-list">${phrasesHTML}</ul>
        </div>
        <div class="sg-section">
          <button class="sg-btn-rewrite" data-action="show-rewrite">
            ${rewriteSuggestion ? 'Lihat Saran Rewrite' : 'Tampilkan Saran Rewrite'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <div class="sg-rewrite-container" style="display: none;">
            ${rewriteSuggestion
              ? `<div class="sg-rewrite-text">${this._escapeHTML(rewriteSuggestion)}</div>`
              : '<div class="sg-rewrite-loading"><div class="sg-skeleton sg-skeleton-line"></div><div class="sg-skeleton sg-skeleton-line sg-skeleton-medium"></div></div>'
            }
          </div>
        </div>
      </div>
      <div class="sg-modal-footer">
        <button class="sg-btn-action" data-action="copy" title="Salin saran" ${!rewriteSuggestion ? 'disabled' : ''}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Salin
        </button>
        <button class="sg-btn-action" data-action="dismiss" title="Tandai sudah dibaca">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          Tandai Dibaca
        </button>
      </div>
    `;
  }

  _buildErrorHTML(errorMessage) {
    return `
      <div class="sg-modal-header sg-error-header">
        <span class="sg-error-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </span>
        <span class="sg-error-title">Gagal Menganalisis</span>
        <button class="sg-btn-icon" data-action="close" title="Tutup" aria-label="Tutup modal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="sg-modal-body">
        <p class="sg-error-message">${this._escapeHTML(errorMessage)}</p>
        <button class="sg-btn-retry" data-action="retry">Coba Lagi</button>
      </div>
    `;
  }

  // === Private: Positioning ===

  _positionModal(x, y) {
    const modal = this._modal;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const modalW = INSPECTOR.MODAL_WIDTH;

    // Offset dari cursor
    let left = x + 16;
    let top = y + 16;

    // Flip horizontal jika mendekati tepi kanan
    if (left + modalW > viewportW - 16) {
      left = x - modalW - 16;
    }

    // Clamp left
    left = Math.max(8, Math.min(left, viewportW - modalW - 8));

    // Flip vertical jika mendekati tepi bawah
    // Estimasi tinggi modal
    const estimatedHeight = INSPECTOR.MODAL_MAX_HEIGHT;
    if (top + estimatedHeight > viewportH - 16) {
      top = y - estimatedHeight - 16;
    }

    // Clamp top
    top = Math.max(8, top);

    modal.style.left = `${left}px`;
    modal.style.top = `${top}px`;
  }

  // === Private: Event Handlers ===

  _attachModalEvents() {
    const modal = this._modal;

    // Prevent modal dari menghilang saat mouse masuk modal
    modal.addEventListener('mouseenter', () => {
      this._isPinned = true;
    });

    // Close button
    const closeBtn = modal.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._forceHide();
        this.hideHighlight();
      });
    }

    // Pin button
    const pinBtn = modal.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._isPinned = !this._isPinned;
        pinBtn.classList.toggle('sg-pinned', this._isPinned);
        pinBtn.title = this._isPinned ? 'Unpin modal' : 'Pin modal';
      });
    }
  }

  _attachResultEvents(data, originalText) {
    const modal = this._modal;

    // Rewrite toggle
    const rewriteBtn = modal.querySelector('[data-action="show-rewrite"]');
    const rewriteContainer = modal.querySelector('.sg-rewrite-container');

    if (rewriteBtn && rewriteContainer) {
      rewriteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        const isVisible = rewriteContainer.style.display !== 'none';
        rewriteContainer.style.display = isVisible ? 'none' : 'block';
        rewriteBtn.classList.toggle('sg-expanded', !isVisible);

        // Lazy-load rewrite jika belum ada
        if (!isVisible && !data.rewriteSuggestion) {
          try {
            const response = await sendToBackground(MSG.REQUEST_REWRITE, {
              text: originalText,
            });

            if (response.success && response.data?.rewriteSuggestion) {
              data.rewriteSuggestion = response.data.rewriteSuggestion;
              const rewriteLoading = rewriteContainer.querySelector('.sg-rewrite-loading');
              if (rewriteLoading) {
                rewriteLoading.outerHTML = `<div class="sg-rewrite-text">${this._escapeHTML(response.data.rewriteSuggestion)}</div>`;
              }
              // Enable copy button
              const copyBtn = modal.querySelector('[data-action="copy"]');
              if (copyBtn) copyBtn.disabled = false;
            } else {
              const rewriteLoading = rewriteContainer.querySelector('.sg-rewrite-loading');
              if (rewriteLoading) {
                rewriteLoading.innerHTML = `<p class="sg-error-message">${response.error || 'Gagal memuat saran'}</p>`;
              }
            }
          } catch (err) {
            const rewriteLoading = rewriteContainer.querySelector('.sg-rewrite-loading');
            if (rewriteLoading) {
              rewriteLoading.innerHTML = `<p class="sg-error-message">${err.message}</p>`;
            }
          }
        }
      });
    }

    // Copy button
    const copyBtn = modal.querySelector('[data-action="copy"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (data.rewriteSuggestion) {
          try {
            await navigator.clipboard.writeText(data.rewriteSuggestion);
            copyBtn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Tersalin!
            `;
            setTimeout(() => {
              copyBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Salin
              `;
            }, 2000);
          } catch {
            // Clipboard API mungkin tidak tersedia
          }
        }
      });
    }

    // Dismiss button
    const dismissBtn = modal.querySelector('[data-action="dismiss"]');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Add hash ke dismissed set
        if (this._currentElement?._sgHash) {
          this._dismissedHashes.add(this._currentElement._sgHash);
        }
        this._forceHide();
        this.hideHighlight();
      });
    }
  }

  // === Private: Utilities ===

  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
