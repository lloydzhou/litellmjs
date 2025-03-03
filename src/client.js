import fetch from 'cross-fetch';

/**
 * Universal HTTP client for making requests to LLM APIs
 */
class LiteLLMClient {
  /**
   * Make a request to an LLM API
   * 
   * @param {string} url - The API endpoint
   * @param {Object} options - Request options
   * @param {Object} options.headers - HTTP headers
   * @param {string} options.method - HTTP method (GET, POST, etc.)
   * @param {Object|null} options.body - Request body (for POST, PUT, etc.)
   * @param {AbortSignal|null} options.signal - AbortController signal
   * @returns {Promise<Object>} - The API response
   */
  async request(url, options = {}) {
    const { headers = {}, method = 'GET', body = null, signal = null, stream = false } = options;
    
    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      signal
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new LiteLLMError(
          `API request failed with status ${response.status}`,
          response.status,
          errorData
        );
      }

      // If streaming is requested, return the raw response
      if (stream) {
        return response;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof LiteLLMError) {
        throw error;
      }
      
      throw new LiteLLMError(
        `Request failed: ${error.message}`,
        500,
        { originalError: error }
      );
    }
  }
}

/**
 * Custom error class for LiteLLM errors
 */
class LiteLLMError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.name = 'LiteLLMError';
    this.status = status;
    this.data = data;
  }
}

export default new LiteLLMClient();
export { LiteLLMClient, LiteLLMError };