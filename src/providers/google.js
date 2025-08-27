import Provider from '../provider.js';
import { PROVIDER_TYPES } from '../types.js';

class GoogleProvider extends Provider {
  static defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta2';
  static providerType = PROVIDER_TYPES.GOOGLE;

  constructor(options = {}) {
    super(options);
  }

  async completion(options) {
    const transformed = this._transformOptions(options);
    const model = options.model || transformed.model;

    // Google GenAI has two common shapes:
    // - endpoint: /v1beta2/models:generateText with body { model, prompt }
    // - endpoint: /v1beta2/models/{model}:generateText with body { prompt }
    // Support both: prefer the model-specific path if model is provided and not already the generic "models:generateText".
    let path;
    if (model && model.includes(':')) {
      // if caller passed something unusual, fall back to model-in-path
      path = `/models/${model}:generateText`;
    } else if (model) {
      // use model-specific path when possible
      path = `/models/${model}:generateText`;
    } else {
      path = `/models:generateText`;
    }

    // Build a conservative request body that works with both shapes.
    const prompt = transformed.messages || transformed.prompt || [];
    const body = model && path === '/models:generateText'
      ? { model, prompt, temperature: transformed.temperature }
      : { prompt, temperature: transformed.temperature };

    return await this.makeRequest(path, { method: 'POST', body });
  }

  _transformMessages(messages) {
    // Keep messages as-is for providers that accept message arrays, but ensure
    // Google provider gets an array or simple prompt structure; caller code
    // can rely on transformed.messages being an array of messages (or strings).
    if (!messages) return undefined;
    // Normalize to an array where each entry is either a string or an object
    return messages.map(m => (typeof m === 'string' ? { role: 'user', content: m } : m));
  }

  async *streamCompletion(options) {
    // Google streaming varies; fallback to non-streaming for now
    const resp = await this.completion(options);
    // convert to a single chunk in OpenAI format
    yield resp;
  }

  _getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  supportsModel(model) {
    return !!model && (model.startsWith('gemini') || model.startsWith('palm'));
  }
}

export default GoogleProvider;
