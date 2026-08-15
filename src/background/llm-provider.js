/**
 * SlopGuard — LLM Provider Abstraction
 * Interface pattern untuk mendukung multiple LLM providers.
 * Fase 1: Gemini API. Fase 3: tambah Groq + Ollama.
 */

import { PROVIDERS, GEMINI, GROQ } from '../shared/constants.js';

/**
 * Factory function: buat provider instance berdasarkan settings.
 * @param {object} settings
 * @returns {GeminiProvider}
 */
export function createProvider(settings) {
  switch (settings.provider) {
    case PROVIDERS.GEMINI:
      return new GeminiProvider(settings);
    case PROVIDERS.GROQ:
      return new GroqProvider(settings);
    case PROVIDERS.OLLAMA:
      return new OllamaProvider(settings);
    default:
      throw new Error(`Provider tidak dikenal: ${settings.provider}`);
  }
}

/**
 * Gemini API Provider
 */
class GeminiProvider {
  /**
   * @param {object} settings
   */
  constructor(settings) {
    this.apiKey = settings.apiKeys?.gemini || settings.apiKey;
    this.model = settings.model || GEMINI.DEFAULT_MODEL;
    this.baseUrl = settings.customEndpoint || GEMINI.BASE_URL;
  }

  /**
   * Kirim prompt ke Gemini dan parse response JSON.
   * @param {{ system: string, user: string }} prompt
   * @returns {Promise<object>} Parsed analysis result
   */
  async analyze(prompt) {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt.user }],
      },
    ];

    if (prompt.image) {
      contents[0].parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: prompt.image
        }
      });
    }

    const body = {
      system_instruction: {
        parts: [{ text: prompt.system }],
      },
      contents: contents,
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || response.statusText;

      if (response.status === 401 || response.status === 403) {
        throw new Error(`API key tidak valid atau tidak memiliki akses. (${response.status}: ${errorMsg})`);
      }
      if (response.status === 429) {
        throw new Error(`Rate limit tercapai. Coba lagi nanti. (${errorMsg})`);
      }
      throw new Error(`Gemini API error ${response.status}: ${errorMsg}`);
    }

    const data = await response.json();
    return this._parseResponse(data);
  }

  /**
   * Test koneksi ke Gemini API.
   * @returns {Promise<{ success: boolean, model: string, message: string }>}
   */
  async testConnection() {
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Respond with exactly: {"status":"ok"}' }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 20,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || response.statusText;
      throw new Error(`Koneksi gagal (${response.status}): ${errorMsg}`);
    }

    return {
      success: true,
      model: this.model,
      message: `Koneksi berhasil ke ${this.model}`,
    };
  }

  /**
   * Parse response dari Gemini API format ke schema internal SlopGuard.
   * @param {object} responseData - Raw Gemini API response
   * @returns {object} Parsed result matching our schema
   */
  _parseResponse(responseData) {
    const candidates = responseData?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('Tidak ada response dari model');
    }

    const content = candidates[0]?.content;
    if (!content || !content.parts || content.parts.length === 0) {
      throw new Error('Response kosong dari model');
    }

    const textContent = content.parts[0]?.text;
    if (!textContent) {
      throw new Error('Tidak ada teks dalam response');
    }

    // Parse JSON dari response text
    let parsed;
    try {
      // Clean up potential markdown code fences
      let cleaned = textContent.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      throw new Error(`Gagal parsing response JSON: ${parseError.message}. Raw: ${textContent.substring(0, 200)}`);
    }

    // Validate required fields
    if (typeof parsed.aiProbability !== 'number') {
      throw new Error('Response tidak mengandung field aiProbability yang valid');
    }

    // Normalize
    return {
      aiProbability: Math.max(0, Math.min(100, Math.round(parsed.aiProbability))),
      statusLabel: parsed.statusLabel || 'needs_review',
      flaggedPhrases: Array.isArray(parsed.flaggedPhrases) ? parsed.flaggedPhrases : [],
      rewriteSuggestion: parsed.rewriteSuggestion || null,
    };
  }
}

/**
 * Groq API Provider (OpenAI Compatible)
 */
class GroqProvider {
  constructor(settings) {
    this.apiKey = settings.apiKeys?.groq || settings.apiKey;
    this.model = settings.model || GROQ.DEFAULT_MODEL;
    this.baseUrl = settings.customEndpoint || GROQ.BASE_URL;
  }

  async analyze(prompt) {
    const url = this.baseUrl;

    let userContent = prompt.user;
    let actualModel = this.model;

    if (prompt.image) {
      throw new Error('Groq saat ini tidak menyediakan model Vision secara gratis. Silakan ganti Provider AI Anda ke Google Gemini (lewat icon SlopGuard) untuk menggunakan fitur Audit Desain Visual.');
    }

    const body = {
      model: actualModel,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userContent }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1500
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorMsg = errorData.error.message;
        }
      } catch (e) {
        // ignore
      }
      if (response.status === 429) {
        throw new Error('Rate limit tercapai. Coba lagi nanti.');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('API Key Groq tidak valid.');
      }
      throw new Error(`Koneksi Groq gagal (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    try {
      const contentStr = data.choices[0].message.content;
      // Hilangkan awalan/akhiran markdown jika ada
      let cleanJson = contentStr.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      
      const parsed = JSON.parse(cleanJson);
      
      return {
        aiProbability: Math.max(0, Math.min(100, Math.round(parsed.aiProbability || 0))),
        statusLabel: parsed.statusLabel || 'needs_review',
        flaggedPhrases: Array.isArray(parsed.flaggedPhrases) ? parsed.flaggedPhrases : [],
        rewriteSuggestion: parsed.rewriteSuggestion || null,
        summary: parsed.summary || null
      };
    } catch (e) {
      console.error('[SlopGuard] Failed to parse JSON from Groq:', e, data);
      throw new Error('Format balasan dari API tidak sesuai ekspektasi.');
    }
  }

  async rewrite(prompt) {
    const url = this.baseUrl;

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.7,
      max_tokens: 1500
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Rewrite API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async testConnection() {
    const url = this.baseUrl;
    
    // Kirim prompt sangat sederhana
    const body = {
      model: this.model,
      messages: [
        { role: 'user', content: 'Respond with "ok"' }
      ],
      max_tokens: 10
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const err = await response.json();
        if (err.error && err.error.message) errorMsg = err.error.message;
      } catch (e) {}
      throw new Error(`Koneksi gagal (${response.status}): ${errorMsg}`);
    }

    return {
      success: true,
      model: this.model,
      message: `Koneksi berhasil ke ${this.model} via Groq`,
    };
  }
}

/**
 * Ollama API Provider (OpenAI Compatible)
 */
class OllamaProvider {
  constructor(settings) {
    // Default endpoint ollama
    const defaultHost = 'http://localhost:11434';
    let host = settings.apiKeys?.ollama || settings.apiKey || defaultHost;
    
    // Hapus trailing slash jika ada
    host = host.replace(/\/$/, '');
    
    this.baseUrl = `${host}/v1/chat/completions`;
    this.model = settings.model || 'llama3';
  }

  async analyze(prompt) {
    if (prompt.image) {
      throw new Error('Provider Ollama belum sepenuhnya dioptimalkan untuk fitur Audit Desain Visual. Silakan ganti Provider AI Anda ke Google Gemini.');
    }

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    };

    let response;
    try {
      response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      throw new Error(`Koneksi ke Ollama gagal. Pastikan Ollama berjalan di komputer Anda (${networkError.message})`);
    }

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch (e) {
        // ignore
      }
      throw new Error(`Koneksi Ollama gagal (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    let textContent = '';

    if (data.choices && data.choices[0] && data.choices[0].message) {
      textContent = data.choices[0].message.content;
    } else {
      throw new Error('Format response dari Ollama tidak sesuai.');
    }

    // Bersihkan code fence jika ada
    let cleanJson = textContent.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (parseError) {
      throw new Error(`Gagal parsing response JSON: ${parseError.message}. Raw: ${textContent.substring(0, 200)}`);
    }

    // Validate required fields
    if (typeof parsed.aiProbability !== 'number') {
      throw new Error('Response tidak mengandung field aiProbability yang valid');
    }

    // Normalize
    return {
      aiProbability: Math.max(0, Math.min(100, Math.round(parsed.aiProbability))),
      statusLabel: parsed.statusLabel || 'needs_review',
      flaggedPhrases: Array.isArray(parsed.flaggedPhrases) ? parsed.flaggedPhrases : [],
      rewriteSuggestion: parsed.rewriteSuggestion || null,
    };
  }

  async rewrite(prompt) {
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: 0.7
    };

    let response;
    try {
      response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      throw new Error(`Koneksi ke Ollama gagal. Pastikan Ollama berjalan di komputer Anda (${networkError.message})`);
    }

    if (!response.ok) {
      throw new Error(`Koneksi Ollama gagal (${response.status})`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    throw new Error('Format balasan dari Ollama tidak sesuai ekspektasi.');
  }

  async testConnection() {
    const body = {
      model: this.model,
      messages: [
        { role: 'user', content: 'Respond with "ok"' }
      ],
      max_tokens: 10
    };

    let response;
    try {
      response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      throw new Error(`Koneksi ke Ollama gagal. Pastikan Ollama berjalan di ${this.baseUrl.replace('/v1/chat/completions', '')} (${networkError.message})`);
    }

    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const err = await response.json();
        if (err.error && err.error.message) errorMsg = err.error.message;
      } catch (e) {}
      throw new Error(`Koneksi gagal (${response.status}): ${errorMsg}`);
    }

    return {
      success: true,
      model: this.model,
      message: `Koneksi berhasil ke ${this.model} via Ollama Lokal`,
    };
  }
}
