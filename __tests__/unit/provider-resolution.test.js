import { describe, it, expect } from 'vitest';
import { LiteLLM } from '../../src/litellm.js';
import { PROVIDER_TYPES } from '../../src/types.js';

describe('provider/model resolution', () => {
  it('prefers explicit provider when using provider/model syntax', () => {
    const lite = new LiteLLM();
    // register minimal providers
    lite.registerProvider(PROVIDER_TYPES.OPENAI, { apiKey: 'akey' });
    lite.registerProvider(PROVIDER_TYPES.ANTHROPIC, { apiKey: 'akey' });

    const { provider, actualModel } = lite.getProviderForModel('openai/gpt-3.5');
    expect(provider).not.toBeNull();
    // provider should be the registered openai provider
    expect(provider.providerType || provider.constructor?.providerType).toBe(PROVIDER_TYPES.OPENAI);
    expect(actualModel).toBe('gpt-3.5');
  });

  it('resolves provider by model prefix when no explicit provider specified', () => {
    const lite = new LiteLLM();
    lite.registerProvider(PROVIDER_TYPES.OPENAI, { apiKey: 'akey' });

    const { provider, actualModel } = lite.getProviderForModel('gpt-3.5');
    expect(provider).not.toBeNull();
    expect(provider.providerType || provider.constructor?.providerType).toBe(PROVIDER_TYPES.OPENAI);
    expect(actualModel).toBe('gpt-3.5');
  });

  it('proxy registration takes precedence over provider resolution (model-only)', () => {
    const lite = new LiteLLM();
    lite.registerProvider(PROVIDER_TYPES.OPENAI, { apiKey: 'akey' });
    // create a proxy that matches a specific model
    lite.createProxy({ name: 'p1', url: 'http://localhost:9000', models: ['gpt-3.5'], headers: {} });

    const res = lite.getProviderForModel('gpt-3.5');
    // getProviderForModel returns proxy object when proxy matches
    const proxy = lite.getProxyForModel('gpt-3.5');
    expect(proxy).not.toBeNull();
    // the function should return the proxy result before provider
    expect(res.provider).toBe(proxy.provider);
  });

  it('proxy registration can match provider/model string when configured', () => {
    const lite = new LiteLLM();
    lite.registerProvider(PROVIDER_TYPES.OPENAI, { apiKey: 'akey' });
    // proxy configured to match the provider/model string explicitly
    lite.createProxy({ name: 'p2', url: 'http://localhost:9000', models: ['openai/gpt-3.5'], headers: {} });

    const res = lite.getProviderForModel('openai/gpt-3.5');
    const proxy = lite.getProxyForModel('openai/gpt-3.5');
    expect(proxy).not.toBeNull();
    expect(res.provider).toBe(proxy.provider);
  });

  it('allows registering multiple providers of same type under different names', () => {
    const lite = new LiteLLM();
    // register two ollama providers with different names
    lite.registerProvider('ollama', { apiKey: 'a1', name: 'ollama-east' });
    lite.registerProvider('ollama', { apiKey: 'a2', name: 'ollama-west' });

    // explicit provider/model syntax should resolve to the named provider
    const r1 = lite.getProviderForModel('ollama-east/some-model');
    const r2 = lite.getProviderForModel('ollama-west/some-model');

    expect(r1.provider).not.toBeNull();
    expect(r2.provider).not.toBeNull();
    expect(r1.provider).not.toBe(r2.provider);
  });

  it('routes model-only names to specific provider instances via registerModelRoute', () => {
    const lite = new LiteLLM();
    lite.registerProvider('ollama', { apiKey: 'a1', name: 'ollama-east' });
    lite.registerProvider('ollama', { apiKey: 'a2', name: 'ollama-west' });

    // route models that start with 'east-' to ollama-east
    lite.registerModelRoute('east-', 'ollama-east');

    const r = lite.getProviderForModel('east-xyz');
    expect(r.provider).not.toBeNull();
    expect(r.provider.providerName).toBe('ollama-east');
  });
});
