/**
 * SlopGuard — Sidebar UI (Phase 2)
 * Slide-in panel for Active Page Audit results.
 */

import { STATUS_LABEL_TEXT, STATUS_COLORS } from '../shared/constants.js';

export class SidebarUI {
  constructor(shadowRoot) {
    this._shadow = shadowRoot;
    this._sidebar = null;
    this._createSidebar();
  }

  showLoading() {
    this._sidebar.style.transform = 'translateX(0)';
    this._sidebar.innerHTML = this._buildLoadingHTML();
    this._attachEvents();
  }

  showResult(data) {
    this._sidebar.innerHTML = this._buildResultHTML(data);
    this._attachEvents();
  }

  showError(errorMsg, retryCallback) {
    this._sidebar.innerHTML = this._buildErrorHTML(errorMsg);
    const retryBtn = this._sidebar.querySelector('#sg-sidebar-retry');
    if (retryBtn && retryCallback) {
      retryBtn.addEventListener('click', () => retryCallback());
    }
    this._attachEvents();
  }

  hide() {
    this._sidebar.style.transform = 'translateX(100%)';
    if (this.onHide) {
      this.onHide();
    }
  }

  _createSidebar() {
    if (!this._sidebar) {
      this._sidebar = document.createElement('div');
      this._sidebar.className = 'sg-sidebar';
      // Default state is hidden to the right
      this._sidebar.style.transform = 'translateX(100%)';
      this._shadow.appendChild(this._sidebar);
    }
  }

  _attachEvents() {
    const closeBtn = this._sidebar.querySelector('.sg-sidebar-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    const gotoBtns = this._sidebar.querySelectorAll('.sg-goto-btn');
    gotoBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = e.currentTarget.getAttribute('data-index');
        if (this.onGotoPhrase) {
          this.onGotoPhrase(parseInt(index, 10));
        }
      });
    });
  }

  _buildLoadingHTML() {
    return `
      <div class="sg-sidebar-header">
        <h2>Audit Halaman</h2>
        <button class="sg-sidebar-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="sg-sidebar-content">
        <div class="sg-sidebar-loading">
          <div class="sg-spinner"></div>
          <p>Menganalisis konten halaman...</p>
          <span class="sg-loading-hint">Ini mungkin memakan waktu beberapa detik.</span>
        </div>
      </div>
    `;
  }

  _buildResultHTML(data) {
    const score = data.aiProbability || 0;
    const label = data.statusLabel || 'needs_review';
    const color = STATUS_COLORS[label] || '#525252';
    const labelText = STATUS_LABEL_TEXT[label] || label;
    const phrases = data.flaggedPhrases || [];

    return `
      <div class="sg-sidebar-header">
        <h2>Hasil Audit Halaman</h2>
        <button class="sg-sidebar-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="sg-sidebar-content">
        <div class="sg-sidebar-card" style="border-left: 4px solid ${color}">
          <div class="sg-score-large" style="color: ${color}">${score}%</div>
          <div class="sg-label-large">${labelText}</div>
          <p class="sg-summary-text">${data.summary || 'Teks ini menunjukkan pola yang konsisten dengan teks buatan AI atau manusia.'}</p>
        </div>

        ${phrases.length > 0 ? `
          <div class="sg-phrases-section">
            <h3>Frasa Terdeteksi (${phrases.length})</h3>
            <ul class="sg-sidebar-phrases">
              ${phrases.map((p, i) => `
                <li style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                  <span>${p}</span>
                  <button class="sg-goto-btn" data-index="${i}" title="Scroll ke lokasi" style="background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px;">👁️</button>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : `
          <div class="sg-phrases-section">
            <p class="sg-no-phrases">Tidak ada frasa klise dominan yang terdeteksi.</p>
          </div>
        `}
      </div>
    `;
  }

  _buildErrorHTML(errorMsg) {
    return `
      <div class="sg-sidebar-header">
        <h2>Audit Gagal</h2>
        <button class="sg-sidebar-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="sg-sidebar-content">
        <div class="sg-sidebar-error">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p>${errorMsg}</p>
          <button id="sg-sidebar-retry" class="sg-sidebar-btn">Coba Lagi</button>
        </div>
      </div>
    `;
  }
}
