import { MODEL_PREFIXES, PROVIDER_TYPES } from './types.js';
import OpenAIProvider from './providers/openai.js';
import AnthropicProvider from './providers/anthropic.js';
import { LiteLLMError } from './client.js';

/**
 * LiteLLM class for unified access to various LLM providers
 */
class LiteLLM {
  /**
   * Initialize a new LiteLLM instance
   */
  constructor() {
    this.providers = {};
    this.proxies = [];
  }

  /**
   * Register a provider for use with LiteLLM
   * 
   * @param {string} type - Provider type (e.g., 'openai', 'anthropic')
   * @param {Object} options - Provider options
   * @returns {Provider} - The registered provider
   */
  registerProvider(type, options) {
    let provider;
    
    switch (type) {
      case PROVIDER_TYPES.OPENAI:
        provider = new OpenAIProvider(options);
        break;
      case PROVIDER_TYPES.ANTHROPIC:
        provider = new AnthropicProvider(options);
        break;
      // Add other providers here
      default:
        throw new LiteLLMError(`Unsupported provider type: ${type}`, 400);
    }
    
    this.providers[type] = provider;
    return provider;
  }

  /**
   * Register a proxy configuration
   * 
   * @param {ProxyConfig} proxyConfig - Proxy configuration
   */
  registerProxy(proxyConfig) {
    this.proxies.push(proxyConfig);
  }

  /**
   * Determine the provider type from a model name
   * 
   * @param {string} model - Model name
   * @returns {string|null} - Provider type or null if unknown
   */
  getProviderTypeForModel(model) {
    for (const [prefix, providerType] of Object.entries(MODEL_PREFIXES)) {
      if (model.startsWith(prefix)) {
        return providerType;
      }
    }
    return null;
  }

  /**
   * Get the appropriate provider for a model
   * 
   * @param {string} model - Model name
   * @returns {Provider|null} - Provider for the model or null if not found
   */
  getProviderForModel(model) {
    // Check if there's a proxy for this model
    const proxy = this.getProxyForModel(model);
    if (proxy) {
      return proxy;
    }

    // Find provider by model prefix
    const providerType = this.getProviderTypeForModel(model);
    if (providerType && this.providers[providerType]) {
      return this.providers[providerType];
    }

    // Check all providers to see if any explicitly support this model
    for (const provider of Object.values(this.providers)) {
      if (provider.supportsModel && provider.supportsModel(model)) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Get the appropriate proxy for a model
   * 
   * @param {string} model - Model name
   * @returns {Provider|null} - Proxy provider for the model or null if not found
   */
  getProxyForModel(model) {
    for (const proxy of this.proxies) {
      if (proxy.models.includes(model) || proxy.models.includes('*')) {
        return proxy.provider;
      }
    }
    return null;
  }

  /**
   * Generate a completion for the given messages
   * 
   * @param {CompletionOptions} options - Completion options
   * @returns {Promise<Object>} - The completion response
   */
  async completion(options) {
    const { model } = options;
    const provider = this.getProviderForModel(model);
    
    if (!provider) {
      throw new LiteLLMError(`No provider found for model: ${model}`, 400);
    }
    
    return await provider.completion(options);
  }

  /**
   * Generate a streaming completion for the given messages
   * 
   * @param {CompletionOptions} options - Completion options
   * @returns {AsyncGenerator} - An async generator that yields completion chunks
   */
  async *streamCompletion(options) {
    const { model } = options;
    const provider = this.getProviderForModel(model);
    
    if (!provider) {
      throw new LiteLLMError(`No provider found for model: ${model}`, 400);
    }
    
    yield* provider.streamCompletion(options);
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
   * Create a proxy provider
   * 
   * @param {Object} options - Proxy options
   * @param {string} options.url - The proxy URL
   * @param {Object} options.headers - Headers to include with proxy requests
   * @param {Array<string>} options.models - List of models to route through this proxy
   * @param {string} options.name - The name of the proxy
   * @returns {void}
   */
  createProxy(options) {
    const { url, headers = {}, models = ['*'], name } = options;
    const self = this;
    
    // Create a custom provider for this proxy
    const proxyProvider = {
      completion: async (completionOptions) => {
        const response = await fetch(`${url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify(completionOptions)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new LiteLLMError(
            `Proxy request failed with status ${response.status}`,
            response.status,
            errorData
          );
        }
        
        return await response.json();
      },
      
      streamCompletion: async function* (completionOptions) {
        const response = await fetch(`${url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({
            ...completionOptions,
            stream: true
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new LiteLLMError(
            `Proxy request failed with status ${response.status}`,
            response.status,
            errorData
          );
        }
        
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
                yield* self._processChunk(chunk);
              }
            } finally {
              reader.releaseLock();
            }
          } 
          // Node.js environment with response.body as a Node.js Readable stream
          else if (typeof response.body.on === 'function') {
            for await (const chunk of response.body) {
              const strChunk = new TextDecoder('utf-8').decode(chunk);
              yield* self._processChunk(strChunk);
            }
          }
        } else if (typeof response.text === 'function') {
          // Fallback for environments where we can't directly access the stream
          const text = await response.text();
          yield* self._processChunk(text);
        }
      }
    };
    
    // Register this proxy
    this.registerProxy({
      name,
      models,
      url,
      headers,
      provider: proxyProvider
    });
  }
}

// Create and export a singleton instance
const liteLLM = new LiteLLM();

export default liteLLM;
export { LiteLLM };