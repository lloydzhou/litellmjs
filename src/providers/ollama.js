import Provider from '../provider.js';
import { PROVIDER_TYPES } from '../types.js';

class OllamaProvider extends Provider {
  static defaultBaseUrl = 'http://localhost:11434';
  static providerType = PROVIDER_TYPES.OLLAMA;

  constructor(options = {}) {
    super(options);
  }

  async completion(options) {
    const transformed = this._transformOptions(options);
    // Ollama expects POST /api/chat with { model, messages }
    return await this.makeRequest('/api/chat', { method: 'POST', body: transformed });
  }

  async *streamCompletion(options) {
    const transformed = this._transformOptions({ ...options, stream: true });
    const response = await this.makeRequest('/api/chat', { method: 'POST', body: transformed, stream: true });
    if (typeof response.body?.getReader === 'function') {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          yield* this._processChunk(chunk);
        }
      } finally {
        reader.releaseLock();
      }
    } else if (typeof response.body?.on === 'function') {
      for await (const c of response.body) {
        yield* this._processChunk(new TextDecoder('utf-8').decode(c));
      }
    } else if (typeof response.text === 'function') {
      const text = await response.text();
      yield* this._processChunk(text);
    }
  }

  _getAuthHeaders() {
    return this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {};
  }

  supportsModel(model) {
    return !!model && model.startsWith('ollama');
  }
}

export default OllamaProvider;
