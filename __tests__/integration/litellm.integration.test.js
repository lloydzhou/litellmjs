import { describe, it, expect, beforeAll } from 'vitest';
import liteLLM, { LiteLLM } from '../../src/litellm.js';
import { makeOpenAIMock, makeAnthropicMock } from './provider-mocks.js';

describe('integration: liteLLM (requires network) - mocked locally', () => {
  // We'll register mocks onto the singleton instance
  beforeAll(() => {
    // clear any existing providers/proxies by creating a fresh instance
    // NOTE: src/litellm.js exports a singleton; create a new instance for tests
    // by importing the LiteLLM class and creating a fresh instance.
    // But to keep compatibility, we'll operate on the singleton for now.
  // assign mocks directly to avoid registerProvider constructing real providers
  liteLLM.providers['openai'] = makeOpenAIMock();
  liteLLM.providers['anthropic'] = makeAnthropicMock();

    // register proxies similar to test.js
    liteLLM.createProxy({ name: 'standard-proxy', url: 'https://example-proxy.local', models: ['proxy-model'] });
    liteLLM.createProxy({ name: 'deepseek', url: 'https://api.deepseek.com', models: ['gpt-4-proxy'], proxyModel: 'deepseek-chat' });
  });

  it('getProviderForModel should resolve providers and actual models', () => {
    const testModels = [
      'gpt-3.5-turbo',
      'openai/gpt-3.5-turbo',
      'claude-2',
      'anthropic/claude-2',
      'proxy-model',
      'gpt-4-proxy'
    ];

    for (const model of testModels) {
      const { provider, actualModel } = liteLLM.getProviderForModel(model);
      expect(actualModel).toBeTruthy();
      // proxy models should return a provider object with isProxy true when applicable
      if (model === 'proxy-model' || model === 'gpt-4-proxy') {
        // proxies are registered with registerProxy which stores provider on proxy config
        const proxy = liteLLM.getProxyForModel(model);
        expect(proxy).not.toBeNull();
      } else {
        expect(provider).not.toBeNull();
      }
    }
  });

  it('completion() should return OpenAI-like response for openai model', async () => {
    const response = await liteLLM.completion({ model: 'openai/gpt-3.5-turbo', messages: [{ role: 'user', content: '你好' }] });
    expect(response).toHaveProperty('id');
    expect(response.object).toBe('chat.completion');
    expect(Array.isArray(response.choices)).toBe(true);
    expect(response.choices[0].message.role).toBe('assistant');
  });

  it('completion() should return Anthropic-like response for anthropic model', async () => {
    const response = await liteLLM.completion({ model: 'anthropic/claude-2', messages: [{ role: 'user', content: '你好' }] });
    expect(response).toHaveProperty('id');
    expect(response.object).toBe('chat.completion');
    expect(Array.isArray(response.choices)).toBe(true);
    expect(response.choices[0].message.role).toBe('assistant');
  });

  it('streamCompletion() async iterator yields chunks for openai', async () => {
    const chunks = [];
    for await (const chunk of liteLLM.streamCompletion({ model: 'openai/gpt-3.5-turbo', messages: [{ role: 'user', content: '测试流式' }] })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].object).toBe('chat.completion.chunk');
  });

  it('streamCompletion() async iterator yields chunks for anthropic', async () => {
    const chunks = [];
    for await (const chunk of liteLLM.streamCompletion({ model: 'anthropic/claude-2', messages: [{ role: 'user', content: '测试流式' }] })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].object).toBe('chat.completion.chunk');
  });
});