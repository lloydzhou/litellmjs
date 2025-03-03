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
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || this.constructor.defaultBaseUrl;
    this.defaultParams = options.defaultParams || {};
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