import Provider from '../provider.js';
import { PROVIDER_TYPES } from '../types.js';

class AzureProvider extends Provider {
  static defaultBaseUrl = 'https://api.openai.azure.com/v1';
  static providerType = PROVIDER_TYPES.AZURE;

  constructor(options = {}) {
    super(options);
  }

  async completion(options) {
    const transformed = this._transformOptions(options);
  // Azure OpenAI expects a deployment path: /openai/deployments/{deployment}/chat/completions?api-version={version}
  const deployment = this.options.deployment || options.deployment || transformed.model || 'deployment';
  const apiVersion = this.options.apiVersion || options.apiVersion || '2023-10-01';
  const path = `/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  return await this.makeRequest(path, { method: 'POST', body: transformed });
  }

  async *streamCompletion(options) {
    const transformed = this._transformOptions({ ...options, stream: true });
  const deployment = this.options.deployment || options.deployment || transformed.model || 'deployment';
  const apiVersion = this.options.apiVersion || options.apiVersion || '2023-10-01';
  const path = `/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const response = await this.makeRequest(path, { method: 'POST', body: transformed, stream: true });
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
    return {
      'api-key': this.apiKey
    };
  }

  supportsModel(model) {
    return model && (model.startsWith('gpt-') || model.startsWith('azure'));
  }
}

export default AzureProvider;
