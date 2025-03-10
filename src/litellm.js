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
   * Parse model string to extract provider and actual model name
   * Supports formats: "provider/model" and "model"
   * 
   * @param {string} modelString - The model string to parse
   * @returns {Object} - Object with provider and model properties
   */
  parseModelString(modelString) {
    if (!modelString || typeof modelString !== 'string') {
      return { provider: null, model: modelString };
    }

    const parts = modelString.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return {
        provider: parts[0].toLowerCase(),
        model: parts[1]
      };
    }

    return {
      provider: null,
      model: modelString
    };
  }

  /**
   * Register a provider for use with LiteLLM
   * 
   * @param {string} type - Provider type (e.g., 'openai', 'anthropic')
   * @param {Object} options - Provider options
   * @returns {Provider} - The registered provider
   */
  registerProvider(type, options) {
    const providerType = type.toLowerCase();
    let provider;
    
    switch (providerType) {
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
    
    this.providers[providerType] = provider;
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
   * Get the appropriate proxy for a model
   * 
   * @param {string} modelString - Model string (can be "provider/model" or just "model")
   * @returns {Object|null} - Proxy provider and model name or null if not found
   */
  getProxyForModel(modelString) {
    const { provider, model } = this.parseModelString(modelString);
    
    // Check if any proxy handles this model
    for (const proxy of this.proxies) {
      if (proxy.models.includes(model) || 
          proxy.models.includes(modelString) || 
          proxy.models.includes('*')) {
        return { 
          provider: proxy.provider,
          actualModel: proxy.proxyModel || model
        };
      }
    }
    return null;
  }

  /**
   * Get the appropriate provider for a model
   * 
   * @param {string} modelString - Model string (can be "provider/model" or just "model")
   * @returns {Object} - Object with provider and actualModel properties
   */
  getProviderForModel(modelString) {
    const { provider: explicitProvider, model: actualModel } = this.parseModelString(modelString);
    
    // Check if there's a proxy for this model
    const proxyResult = this.getProxyForModel(modelString);
    if (proxyResult) {
      return proxyResult;
    }

    // If explicit provider is specified, try to use it
    if (explicitProvider && this.providers[explicitProvider]) {
      return { 
        provider: this.providers[explicitProvider],
        actualModel
      };
    }

    // Find provider by model prefix
    const providerType = this.getProviderTypeForModel(actualModel || modelString);
    if (providerType && this.providers[providerType]) {
      return {
        provider: this.providers[providerType],
        actualModel: actualModel || modelString
      };
    }

    // Check all providers to see if any explicitly support this model
    for (const [name, provider] of Object.entries(this.providers)) {
      if (provider.supportsModel && provider.supportsModel(actualModel || modelString)) {
        return {
          provider,
          actualModel: actualModel || modelString
        };
      }
    }

    return { provider: null, actualModel: actualModel || modelString };
  }

  /**
   * Generate a completion for the given messages
   * 
   * @param {CompletionOptions} options - Completion options
   * @returns {Promise<Object>} - The completion response
   */
  async completion(options) {
    const { model: modelString } = options;
    const { provider, actualModel } = this.getProviderForModel(modelString);
    
    if (!provider) {
      throw new LiteLLMError(`No provider found for model: ${modelString}`, 400);
    }

    // Create a new options object with the actual model name
    const completionOptions = {
      ...options,
      model: actualModel
    };
    
    return await provider.completion(completionOptions);
  }

  /**
   * Generate a streaming completion for the given messages
   * 
   * @param {CompletionOptions} options - Completion options
   * @returns {AsyncGenerator} - An async generator that yields completion chunks
   */
  async *streamCompletion(options) {
    const { model: modelString } = options;
    const { provider, actualModel } = this.getProviderForModel(modelString);
    
    if (!provider) {
      throw new LiteLLMError(`No provider found for model: ${modelString}`, 400);
    }

    // Create a new options object with the actual model name
    const completionOptions = {
      ...options,
      model: actualModel
    };
    
    yield* provider.streamCompletion(completionOptions);
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
   * @param {string} [options.proxyModel] - Optional model to use when making requests through the proxy
   * @returns {void}
   */
  createProxy(options) {
    const { url, headers = {}, models = ['*'], name, proxyModel = null } = options;
    const self = this;
    
    // Create a custom provider for this proxy
    const proxyProvider = {
      // Add properties to help identify this as a proxy provider
      isProxy: true, 
      proxyName: name,
      providerType: 'proxy',
      
      completion: async (completionOptions) => {
        // If proxyModel is specified, use it instead of the requested model
        const finalOptions = {
          ...completionOptions,
          model: proxyModel || completionOptions.model
        };

        const response = await fetch(`${url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify(finalOptions)
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
        // If proxyModel is specified, use it instead of the requested model
        const finalOptions = {
          ...completionOptions,
          model: proxyModel || completionOptions.model,
          stream: true
        };

        const response = await fetch(`${url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify(finalOptions)
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
      provider: proxyProvider,
      proxyModel // Store the proxyModel with the proxy configuration
    });

    console.log(`Proxy '${name}' registered for models: ${models.join(', ')}${proxyModel ? ` (using proxyModel: ${proxyModel})` : ''}`);
  }
}

// Create and export a singleton instance
const liteLLM = new LiteLLM();

export default liteLLM;
export { LiteLLM };