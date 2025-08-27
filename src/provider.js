import client from './client.js';

/**
 * Base provider class for all LLM providers
 */
class Provider {
  /**
   * Initialize a new provider
   * 
   * @param {Object} options - Provider options
   * @param {string} options.apiKey - API key for the provider
   * @param {string} [options.baseUrl] - Base URL for the provider's API
   * @param {Object} [options.defaultParams={}] - Default parameters for all requests
   */
  constructor(options = {}) {
  this.options = options || {};
  this.apiKey = options.apiKey;
  this.baseUrl = options.baseUrl || this.constructor.defaultBaseUrl;
  this.defaultParams = options.defaultParams || {};

  // internal buffering for SSE parsing across chunks
  this._sseBuffer = '';
  // collect parse errors for tests / diagnostics
  this._parseErrors = [];
    // maximum buffered SSE length to avoid OOM from malformed streams
    this._maxSseBuffer = (this.options && this.options.maxSseBuffer) || 64 * 1024; // 64KB
  }

  _appendToSseBuffer(str) {
    this._sseBuffer = (this._sseBuffer || '') + str;
    if (this._sseBuffer.length > this._maxSseBuffer) {
      // reset and record an error
      this._handleParseError(this._sseBuffer, new Error('SSE buffer overflow'));
      this._sseBuffer = '';
    }
  }

  /**
   * Default SSE chunk processor: parses lines that start with 'data:' into JSON objects.
   * Returns an array of parsed objects. Providers may override for provider-specific mapping.
   */
  _processChunk(chunk) {
    const result = [];
    const raw = (this._sseBuffer || '') + chunk;
    const lines = raw.split('\n');

    this._sseBuffer = '';

    for (let line of lines) {
      const originalLine = line;
      if (!originalLine.trim().startsWith('data:')) continue;
      line = originalLine.replace(/^data: /, '').trim();

      if (line === '[DONE]') {
        return result;
      }

      if (!line) continue;

      try {
        const parsed = JSON.parse(line);
        result.push(parsed);
      } catch (e) {
        const trimmed = line.trim();
        const mightBePartial = !/[\]}]$/.test(trimmed);
        if (mightBePartial) {
          this._sseBuffer = originalLine;
          continue;
        }
        this._handleParseError(line, e);
      }
    }

    return result;
  }

  /**
   * Generate a completion for the given messages
   * 
   * @param {CompletionOptions} options - Completion options
   * @returns {Promise<Object>} - The completion response
   */
  async completion(options) {
    throw new Error('Not implemented');
  }

  /**
   * Generate a streaming completion for the given messages
   * 
   * @param {CompletionOptions} options - Completion options
   * @returns {AsyncGenerator} - An async generator that yields completion chunks
   */
  async *streamCompletion(options) {
    throw new Error('Not implemented');
  }

  /**
   * Make a request to the provider's API
   * 
   * @param {string} path - API path
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - The API response
   */
  async makeRequest(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      ...this._getAuthHeaders(),
      ...options.headers
    };

    return await client.request(url, {
      ...options,
      headers
    });
  }

  /**
   * Get authentication headers for the provider
   * 
   * @returns {Object} - Authentication headers
   */
  _getAuthHeaders() {
    throw new Error('Not implemented');
  }

  /**
   * Transform messages to provider-specific format
   * 
   * @param {Array<LLMMessage>} messages - Messages to transform
   * @returns {Array<Object>} - Transformed messages
   */
  _transformMessages(messages) {
    return messages;
  }

  /**
   * Transform options to provider-specific format
   * 
   * @param {CompletionOptions} options - Options to transform
   * @returns {Object} - Transformed options
   */
  _transformOptions(options) {
    return {
      ...this.defaultParams,
      ...options,
      messages: this._transformMessages(options.messages)
    };
  }

  /**
   * Handle a JSON parse error from SSE parsing. Stores the error and optionally logs it
   * @param {string} line
   * @param {Error} error
   */
  _handleParseError(line, error) {
    try {
      this._parseErrors.push({ line, message: error?.message || String(error) });
    } catch (e) {
      // ignore
    }

    if (this.options && this.options.debug) {
      console.error('SSE parse error:', error, 'line:', line);
    }
  }

  _resetSseBuffer() {
    this._sseBuffer = '';
  }

  /**
   * Check if the provider supports the given model
   * 
   * @param {string} model - Model name to check
   * @returns {boolean} - True if the provider supports the model
   */
  supportsModel(model) {
    return false;
  }
}

export default Provider;