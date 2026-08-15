/**
 * SlopGuard — Text Utilities
 * Fungsi utilitas untuk ekstraksi, normalisasi, dan hashing teks.
 */

import { INSPECTOR } from '../shared/constants.js';

/**
 * Cek apakah elemen adalah target teks yang valid untuk inspeksi.
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function isTextElement(el) {
  if (!el || !el.tagName) return false;

  const tag = el.tagName.toLowerCase();

  // Direct text elements
  if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'].includes(tag)) {
    return true;
  }

  // Article sections
  if (tag === 'article') return true;

  // Div with high text density
  if (tag === 'div') {
    return hasHighTextDensity(el);
  }

  return false;
}

/**
 * Cek apakah div memiliki kepadatan teks tinggi (rasio teks vs child tags).
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function hasHighTextDensity(el) {
  const text = el.textContent || '';
  const childElements = el.children.length;

  // Harus punya teks substansial
  if (text.trim().length < 50) return false;

  // Hanya anggap sebagai teks jika punya sedikit child elements relatif terhadap teks
  // (div yang isinya banyak child div bukan target kita)
  if (childElements > 3) return false;

  // Rasio: minimal 20 karakter teks per child element
  if (childElements > 0 && text.trim().length / childElements < 20) return false;

  return true;
}

/**
 * Cek apakah elemen ada di dalam area boilerplate (nav, header, footer, sidebar, dll).
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function isBoilerplate(el) {
  const boilerplateTags = ['nav', 'header', 'footer', 'aside'];
  const boilerplatePatterns = [
    'sidebar', 'ad', 'advertisement', 'banner', 'cookie',
    'newsletter', 'related-posts', 'comments', 'share-buttons',
    'menu', 'nav', 'social', 'widget',
  ];

  let current = el;
  while (current && current !== document.body) {
    const tag = current.tagName?.toLowerCase();

    // Cek tag boilerplate
    if (boilerplateTags.includes(tag)) return true;

    // Cek class/id patterns
    const classAndId = `${current.className || ''} ${current.id || ''}`.toLowerCase();
    for (const pattern of boilerplatePatterns) {
      if (classAndId.includes(pattern)) return true;
    }

    current = current.parentElement;
  }

  return false;
}

/**
 * Cek apakah elemen visible (bukan hidden/display:none).
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function isVisible(el) {
  if (!el) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  return true;
}

/**
 * Extract clean text content dari elemen.
 * @param {HTMLElement} el
 * @returns {string}
 */
export function getTextContent(el) {
  if (!el) return '';
  // Use textContent untuk plain text tanpa HTML tags
  return (el.textContent || '').trim();
}

/**
 * Normalisasi teks untuk hashing: trim, collapse whitespace, lowercase.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Generate SHA-256 hash dari teks.
 * @param {string} text
 * @returns {Promise<string>} Hex string
 */
export async function hashText(text) {
  const normalized = normalizeText(text);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cek apakah teks memenuhi panjang minimum.
 * @param {string} text
 * @param {number} threshold
 * @returns {boolean}
 */
export function meetsMinLength(text, threshold = INSPECTOR.MIN_TEXT_LENGTH) {
  return text && text.trim().length >= threshold;
}

/**
 * Dapatkan bounding rect relatif terhadap viewport.
 * @param {HTMLElement} el
 * @returns {DOMRect}
 */
export function getElementRect(el) {
  return el.getBoundingClientRect();
}

/**
 * Ekstraksi seluruh teks halaman dengan mengabaikan elemen boilerplate.
 * Digunakan untuk Active Page Audit.
 * @returns {string[]} Array teks dari elemen-elemen valid
 */
export function extractFullPageText() {
  const elements = document.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, article');
  const texts = [];
  const processedNodes = new Set();

  for (const el of elements) {
    if (processedNodes.has(el)) continue;

    if (isVisible(el) && !isBoilerplate(el)) {
      const text = getTextContent(el);
      if (meetsMinLength(text)) {
        texts.push(text);
        processedNodes.add(el);
        // Mark children as processed to avoid duplicates
        const children = el.querySelectorAll('*');
        for (const child of children) {
          processedNodes.add(child);
        }
      }
    }
  }

  // Fallback to div if texts is too small (maybe it's a div-heavy site)
  if (texts.length < 5) {
    const divs = document.body.querySelectorAll('div');
    for (const div of divs) {
      if (processedNodes.has(div)) continue;
      
      if (hasHighTextDensity(div) && isVisible(div) && !isBoilerplate(div)) {
        const text = getTextContent(div);
        if (meetsMinLength(text)) {
          texts.push(text);
          processedNodes.add(div);
          const children = div.querySelectorAll('*');
          for (const child of children) {
            processedNodes.add(child);
          }
        }
      }
    }
  }

  return texts;
}

/**
 * Menggabungkan array of texts menjadi chunks agar tidak melebihi token limit.
 * @param {string[]} texts
 * @param {number} maxChars - Estimasi max karakter per chunk (mis. 25000)
 * @returns {string[]}
 */
export function chunkText(texts, maxChars = 25000) {
  const chunks = [];
  let currentChunk = '';

  for (const text of texts) {
    if (currentChunk.length + text.length > maxChars) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = text;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + text;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}
