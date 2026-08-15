/**
 * SlopGuard — Shared Constants
 * Definisi enum, default values, dan konfigurasi bersama untuk semua komponen.
 */

// === Message Types (Content Script <-> Service Worker <-> Popup) ===
export const MSG = {
  // Inspector Mode
  ANALYZE_ELEMENT: 'ANALYZE_ELEMENT',
  ANALYZE_SELECTION: 'ANALYZE_SELECTION',
  ANALYZE_FULL_PAGE: 'ANALYZE_FULL_PAGE',
  ANALYZE_DESIGN: 'ANALYZE_DESIGN',
  SHOW_SIDEBAR_LOADING: 'SHOW_SIDEBAR_LOADING',
  SHOW_SIDEBAR_RESULT: 'SHOW_SIDEBAR_RESULT',
  SHOW_SIDEBAR_ERROR: 'SHOW_SIDEBAR_ERROR',
  REQUEST_REWRITE: 'REQUEST_REWRITE',

  // Inspector Mode Control
  TOGGLE_INSPECTOR: 'TOGGLE_INSPECTOR',
  SET_INSPECTOR_STATE: 'SET_INSPECTOR_STATE',
  GET_INSPECTOR_STATE: 'GET_INSPECTOR_STATE',

  // Settings & Config
  TEST_CONNECTION: 'TEST_CONNECTION',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  CLEAR_CACHE: 'CLEAR_CACHE',
  CHECK_CACHE: 'CHECK_CACHE',

  // State
  GET_TAB_STATE: 'GET_TAB_STATE',
  UPDATE_BADGE: 'UPDATE_BADGE',
};

// === Status Labels ===
export const STATUS = {
  ORIGINAL: 'original',
  NEEDS_REVIEW: 'needs_review',
  HIGH_SLOP: 'high_slop',
};

// === Status Label Display (Bahasa Indonesia) ===
export const STATUS_LABEL_TEXT = {
  [STATUS.ORIGINAL]: 'Kemungkinan Manusia',
  [STATUS.NEEDS_REVIEW]: 'Perlu Ditinjau',
  [STATUS.HIGH_SLOP]: 'Kemungkinan AI-Generated',
};

// === Status Colors ===
export const STATUS_COLORS = {
  [STATUS.ORIGINAL]: '#22C55E',
  [STATUS.NEEDS_REVIEW]: '#EAB308',
  [STATUS.HIGH_SLOP]: '#EF4444',
};

// === Badge Colors (for toolbar icon) ===
export const BADGE_COLORS = {
  [STATUS.ORIGINAL]: '#166534',
  [STATUS.NEEDS_REVIEW]: '#854D0E',
  [STATUS.HIGH_SLOP]: '#991B1B',
};

// === LLM Providers ===
export const PROVIDERS = {
  GEMINI: 'gemini',
  GROQ: 'groq',
  OLLAMA: 'ollama',
};

// === Analysis Modes ===
export const ANALYSIS_MODE = {
  SCORE_ONLY: 'score_only',
  FULL: 'full',
};

// === Default Settings ===
export const DEFAULT_SETTINGS = {
  provider: PROVIDERS.GEMINI,
  apiKeys: {
    gemini: '',
    groq: '',
    ollama: 'http://localhost:11434',
  },
  model: 'gemini-3.7-flash',
  thresholds: {
    low: 30,   // 0 - low = original
    medium: 65, // low+1 - medium = needs_review
    // medium+1 - 100 = high_slop
  },
  shortcutKey: 'Alt+Shift+S',
  domainList: {
    whitelist: [],
    blacklist: ['localhost'],
  },
  cacheTtlMs: 604800000, // 7 hari
  autoAuditOnNavigate: false,
  includeCredentialsForSameDomainFetch: false,
};

// === Cache Constants ===
export const CACHE = {
  STORAGE_KEY: 'slopguard_cache_v1',
  SETTINGS_KEY: 'slopguard_settings_v1',
  SESSION_KEY_PREFIX: 'slopguard_tab_',
  MAX_MEMORY_ENTRIES: 200,
  MAX_STORAGE_BYTES: 10 * 1024 * 1024, // 10MB
  DEFAULT_TTL_MS: 604800000, // 7 hari
};

// === Inspector Mode Constants ===
export const INSPECTOR = {
  DEBOUNCE_MS: 1000,
  THROTTLE_MS: 50,
  MIN_TEXT_LENGTH: 20,
  TARGET_SELECTORS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'article', 'div'],
  MODAL_WIDTH: 320,
  MODAL_MAX_HEIGHT: 400,
  HIGHLIGHT_COLOR: '#525252',
  HIGHLIGHT_WIDTH: '1px',
  Z_INDEX: 2147483647,
};

// === Gemini API ===
export const GEMINI = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
  DEFAULT_MODEL: 'gemini-3.7-flash',
};

// === Groq API ===
export const GROQ = {
  BASE_URL: 'https://api.groq.com/openai/v1/chat/completions',
  DEFAULT_MODEL: 'llama-3.1-8b-instant',
};
