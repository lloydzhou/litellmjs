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
    this.defaultVersion = options.version || '2023-06-01';
  }

  /**
   * Generate a completion for the given messages
   * 
   * @param {CompletionOptions} options - Completion options
   * @returns {Promise<Object>} - The completion response
   */
  async completion(options) {
    const transformedOptions = this._transformOptions(options);
    
    const response = await this.makeRequest('/messages', {
      method: 'POST',
      body: transformedOptions
    });
    
    // Convert Anthropic response format to OpenAI format
    return this._convertResponseToOpenAIFormat(response, options);
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
            const processedChunks = this._processChunk(chunk);
            
            for (const processedChunk of processedChunks) {
              // Convert each Anthropic chunk to OpenAI format
              yield this._convertStreamChunkToOpenAIFormat(processedChunk, options);
            }
          }
        } finally {
          reader.releaseLock();
        }
      } 
      // Node.js environment with response.body as a Node.js Readable stream
      else if (typeof response.body.on === 'function') {
        for await (const chunk of response.body) {
          const strChunk = new TextDecoder('utf-8').decode(chunk);
          const processedChunks = this._processChunk(strChunk);
          
          for (const processedChunk of processedChunks) {
            // Convert each Anthropic chunk to OpenAI format
            yield this._convertStreamChunkToOpenAIFormat(processedChunk, options);
          }
        }
      }
    } else if (typeof response.text === 'function') {
      // Fallback for environments where we can't directly access the stream
      const text = await response.text();
      const processedChunks = this._processChunk(text);
      
      for (const processedChunk of processedChunks) {
        // Convert each Anthropic chunk to OpenAI format
        yield this._convertStreamChunkToOpenAIFormat(processedChunk, options);
      }
    }
  }

  /**
   * Process a text chunk from a stream
   * 
   * @private
   * @param {string} chunk - The text chunk to process
   * @returns {Array} - Array of parsed JSON objects from the chunk
   */
  _processChunk(chunk) {
    const result = [];
    const lines = chunk
      .split('\n')
      .filter(line => line.trim().startsWith('data:'))
      .map(line => line.replace(/^data: /, '').trim());
    
    for (const line of lines) {
      if (line === '[DONE]') {
        continue;
      }
      
      try {
        if (line) {
          const parsed = JSON.parse(line);
          result.push(parsed);
        }
      } catch (e) {
        console.error('Error parsing SSE line:', line, e);
      }
    }
    
    return result;
  }

  /**
   * Convert Anthropic stream chunk to OpenAI format
   * 
   * @private
   * @param {Object} chunk - Anthropic format chunk
   * @param {Object} options - Original request options
   * @returns {Object} - OpenAI format chunk
   */
  _convertStreamChunkToOpenAIFormat(chunk, options) {
    // Generate a unique ID if needed
    const id = `chatcmpl-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
    
    // Default structure for OpenAI format
    const openAIFormat = {
      id: id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: options.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: null
        }
      ]
    };

    // Handle different Anthropic SSE event types
    if (chunk.type === 'content_block_start') {
      // Content block start doesn't contain actual content yet
      return openAIFormat;
    } 
    else if (chunk.type === 'content_block_delta') {
      if (chunk.delta.type === 'text_delta' && chunk.delta.text) {
        openAIFormat.choices[0].delta.content = chunk.delta.text;
      }
      // Handle tool calls in streaming mode
      else if (chunk.delta.type === 'tool_use') {
        // For tool_use, we need to convert to function_call format
        openAIFormat.choices[0].delta.function_call = {
          name: chunk.delta.name || '',
          arguments: chunk.delta.input ? JSON.stringify(chunk.delta.input) : ''
        };
        openAIFormat.choices[0].finish_reason = 'function_call';
      }
    } 
    else if (chunk.type === 'content_block_stop') {
      // End of a content block
      openAIFormat.choices[0].finish_reason = 'stop';
    }
    else if (chunk.type === 'message_stop') {
      // End of the entire message
      openAIFormat.choices[0].finish_reason = 'stop';
    }
    
    return openAIFormat;
  }

  /**
   * Convert complete Anthropic response to OpenAI format
   * 
   * @private
   * @param {Object} response - Anthropic format response
   * @param {Object} options - Original request options
   * @returns {Object} - OpenAI format response
   */
  _convertResponseToOpenAIFormat(response, options) {
    // Generate a unique ID if needed
    const id = `chatcmpl-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
    
    // Extract content and handle different content types
    let content = null;
    let functionCall = null;
    
    if (response.content && Array.isArray(response.content)) {
      // Process different types of content blocks
      for (const block of response.content) {
        if (block.type === 'text') {
          content = block.text;
        } 
        else if (block.type === 'tool_use') {
          // Convert tool_use to function_call
          functionCall = {
            name: block.name,
            arguments: JSON.stringify(block.input)
          };
        }
      }
    }
    
    // Map Anthropic stop_reason to OpenAI finish_reason
    let finishReason = 'stop';
    if (response.stop_reason === 'tool_use') {
      finishReason = 'function_call';
    } else if (response.stop_reason === 'max_tokens') {
      finishReason = 'length';
    }
    
    // Build message object
    const message = {
      role: 'assistant',
      content: content
    };
    
    // Add function_call if present
    if (functionCall) {
      message.function_call = functionCall;
      message.content = null; // OpenAI sets content to null when there's a function call
    }
    
    // Create OpenAI-format response
    return {
      id: id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: options.model,
      choices: [
        {
          index: 0,
          message: message,
          finish_reason: finishReason
        }
      ],
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }

  /**
   * Get authentication headers for Anthropic
   * 
   * @returns {Object} - Anthropic authentication headers
   */
  _getAuthHeaders() {
    return {
      'X-API-Key': this.apiKey,
      'anthropic-version': this.defaultVersion
    };
  }

  /**
   * Transform messages to Anthropic-specific format
   * 
   * @param {Array<LLMMessage>} messages - Messages to transform
   * @returns {Array<Object>} - Transformed messages
   */
  _transformMessages(messages) {
    if (!messages || !Array.isArray(messages)) {
      return [];
    }
    
    // Anthropic uses a different format for messages
    // Extract system message if present
    let systemMessage = '';
    const formattedMessages = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        systemMessage = message.content;
      } else if (message.role === 'user' || message.role === 'assistant') {
        formattedMessages.push({
          role: message.role,
          content: message.content
        });
        
        // Handle function calls from user (tool results)
        if (message.role === 'user' && message.function_call_result) {
          formattedMessages.push({
            role: 'tool',
            name: message.function_call_result.name,
            content: message.function_call_result.content
          });
        }
        
        // Handle function calls from assistant
        if (message.role === 'assistant' && message.function_call) {
          // Anthropic expects tool_use inside the content array
          formattedMessages.push({
            role: 'assistant',
            content: [{
              type: 'tool_use',
              name: message.function_call.name,
              input: JSON.parse(message.function_call.arguments)
            }]
          });
        }
      }
    }
    
    return formattedMessages;
  }

  /**
   * Transform options to Anthropic-specific format
   * 
   * @param {CompletionOptions} options - Options to transform
   * @returns {Object} - Transformed options for Anthropic
   */
  _transformOptions(options) {
    const messages = this._transformMessages(options.messages);
    
    const transformed = {
      ...this.defaultParams,
      model: options.model,
      messages: messages,
      stream: options.stream || false,
    };
    
    // Extract all system messages and combine them if there are multiple
    const systemMessages = options.messages?.filter(m => m.role === 'system') || [];
    if (systemMessages.length > 1) {
      // Multiple system messages, combine them into a single system message
      const combinedContent = systemMessages.map(m => m.content).join('\n');
      transformed.system = combinedContent;

      // Remove all system messages and add a single combined one
      options.messages = options.messages.filter(m => m.role !== 'system');
    }

    // Add completion parameters
    // max_tokens is required for Anthropic
    transformed.max_tokens = options.max_tokens || 2048;
    transformed.stop = options.stop || ['stop', 'max_tokens'];
    if (options.temperature !== undefined) {
      transformed.temperature = options.temperature;
    }

    if (options.tools || options.functions) {
      // Convert OpenAI functions/tools to Anthropic tools
      const tools = options.tools || 
        (options.functions ? [{ type: 'function', functions: options.functions }] : []);
        
      transformed.tools = tools.map(tool => {
        if (tool.type === 'function') {
          return {
            name: tool.function.name,
            description: tool.function.description,
            input_schema: tool.function.parameters
          };
        }
        return tool;
      });
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