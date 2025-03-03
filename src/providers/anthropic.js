import Provider from '../provider.js';
import { PROVIDER_TYPES } from '../types.js';

class AnthropicProvider extends Provider {
  static defaultBaseUrl = 'https://api.anthropic.com/v1';
  static providerType = PROVIDER_TYPES.ANTHROPIC;
  
  /**
   * Initialize a new Anthropic provider
   * 
   * @param {Object} options - Provider options
   * @param {string} options.apiKey - Anthropic API key
   * @param {string} [options.baseUrl] - Base URL for the Anthropic API
   * @param {Object} [options.defaultParams={}] - Default parameters for all requests
   */
  constructor(options = {}) {
    super(options);
  }

  /**
   * Generate a completion for the given messages
   * 
   * @param {CompletionOptions} options - Completion options
   * @returns {Promise<Object>} - The completion response
   */
  async completion(options) {
    const transformedOptions = this._transformOptions(options);
    
    return await this.makeRequest('/messages', {
      method: 'POST',
      body: transformedOptions
    });
  }

  /**
   * Generate a streaming completion for the given messages
   * 
   * @param {CompletionOptions} options - Completion options
   * @returns {AsyncGenerator} - An async generator that yields completion chunks
   */
  async *streamCompletion(options) {
    const transformedOptions = this._transformOptions({
      ...options,
      stream: true
    });
    
    const response = await this.makeRequest('/messages', {
      method: 'POST',
      body: transformedOptions,
      stream: true
    });

    // Handle streaming in a way that works in both Node.js and browser environments
    if (typeof response.body === 'object' && response.body !== null) {
      // Browser environment or Node.js with fetch that supports ReadableStream
      if (typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }
            
            const chunk = decoder.decode(value);
            yield* this._processChunk(chunk);
          }
        } finally {
          reader.releaseLock();
        }
      } 
      // Node.js environment with response.body as a Node.js Readable stream
      else if (typeof response.body.on === 'function') {
        for await (const chunk of response.body) {
          const strChunk = new TextDecoder('utf-8').decode(chunk);
          yield* this._processChunk(strChunk);
        }
      }
    } else if (typeof response.text === 'function') {
      // Fallback for environments where we can't directly access the stream
      const text = await response.text();
      yield* this._processChunk(text);
    }
  }

  /**
   * Process a text chunk from a stream
   * 
   * @private
   * @param {string} chunk - The text chunk to process
   * @returns {Array} - Array of parsed JSON objects from the chunk
   */
  *_processChunk(chunk) {
    const lines = chunk
      .split('\n')
      .filter(line => line.trim().startsWith('data:'))
      .map(line => line.replace(/^data: /, '').trim());
    
    for (const line of lines) {
      if (line === '[DONE]') {
        return;
      }
      
      try {
        if (line) {
          const parsed = JSON.parse(line);
          yield parsed;
        }
      } catch (e) {
        console.error('Error parsing SSE line:', line, e);
      }
    }
  }

  /**
   * Get authentication headers for Anthropic
   * 
   * @returns {Object} - Anthropic authentication headers
   */
  _getAuthHeaders() {
    return {
      'X-API-Key': this.apiKey,
      'anthropic-version': '2023-06-01'
    };
  }

  /**
   * Transform messages to Anthropic-specific format
   * 
   * @param {Array<LLMMessage>} messages - Messages to transform
   * @returns {Array<Object>} - Transformed messages
   */
  _transformMessages(messages) {
    return messages;
  }

  /**
   * Transform options to Anthropic-specific format
   * 
   * @param {CompletionOptions} options - Options to transform
   * @returns {Object} - Transformed options for Anthropic
   */
  _transformOptions(options) {
    const transformed = {
      ...this.defaultParams,
      model: options.model,
      messages: this._transformMessages(options.messages),
      stream: options.stream || false,
    };

    if (options.max_tokens) {
      transformed.max_tokens = options.max_tokens;
    }

    if (options.temperature !== undefined) {
      transformed.temperature = options.temperature;
    }

    if (options.additional_params) {
      Object.assign(transformed, options.additional_params);
    }

    return transformed;
  }

  /**
   * Check if Anthropic supports the given model
   * 
   * @param {string} model - Model name to check
   * @returns {boolean} - True if Anthropic supports the model
   */
  supportsModel(model) {
    return model.startsWith('claude-');
  }
}

export default AnthropicProvider;