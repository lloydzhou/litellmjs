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
  const path = `/models/${model}:generateText`;
  // Google expects a different request shape; wrap messages into 'prompt' or 'input'
  const body = { prompt: transformed.messages || [], temperature: transformed.temperature };
  return await this.makeRequest(path, { method: 'POST', body });
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
