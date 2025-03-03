/**
 * @typedef {Object} LLMMessage
 * @property {string} role - The role of the message sender (system, user, assistant)
 * @property {string} content - The content of the message
 */

/**
 * @typedef {Object} CompletionOptions
 * @property {string} model - The name of the model to use
 * @property {Array<LLMMessage>} messages - Array of messages to generate completions for
 * @property {number} [temperature=0.7] - Sampling temperature
 * @property {number} [max_tokens] - Maximum number of tokens to generate
 * @property {boolean} [stream=false] - Whether to stream the response
 * @property {Object} [additional_params] - Any additional provider-specific parameters
 */

/**
 * @typedef {Object} LLMProvider
 * @property {string} name - Provider name
 * @property {string} baseUrl - Base URL for the provider's API
 * @property {Array<string>} models - List of supported models
 */

/**
 * @typedef {Object} ProxyConfig
 * @property {string} name - The name of the proxy configuration
 * @property {Array<string>} models - List of models to route through this proxy
 * @property {string} url - The proxy URL
 * @property {Object} headers - Headers to include with requests to this proxy
 */

export const PROVIDER_TYPES = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  AZURE: 'azure',
  GOOGLE: 'google',
  COHERE: 'cohere',
  HUGGINGFACE: 'huggingface'
};

export const MODEL_PREFIXES = {
  'gpt': PROVIDER_TYPES.OPENAI,
  'claude': PROVIDER_TYPES.ANTHROPIC,
  'azure': PROVIDER_TYPES.AZURE,
  'gemini': PROVIDER_TYPES.GOOGLE,
  'palm': PROVIDER_TYPES.GOOGLE,
  'command': PROVIDER_TYPES.COHERE
};