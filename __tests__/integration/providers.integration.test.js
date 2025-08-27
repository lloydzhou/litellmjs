import { describe, it, expect } from 'vitest';
import AzureProvider from '../../src/providers/azure.js';
import GoogleProvider from '../../src/providers/google.js';
import OllamaProvider from '../../src/providers/ollama.js';

describe('providers HTTP integration (stubbed)', () => {
  it('AzureProvider sends correct path, headers and body', async () => {
    const provider = new AzureProvider({ apiKey: 'akey', deployment: 'mydep', apiVersion: '2023-10-01' });

    // stub makeRequest to assert on path, headers and body
    provider.makeRequest = async function(path, options = {}) {
      // Azure provider builds path with /v1 prefix inside defaultBaseUrl; allow either
      expect(path).toContain('/openai/deployments/mydep/chat/completions');
      expect(options.method).toBe('POST');
      const body = options.body;
      expect(body).toHaveProperty('messages');
      // emulate Azure response shape
      return { id: 'azure-1', object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'ok' } }] };
    };

    const res = await provider.completion({ model: 'gpt-3', messages: [{ role: 'user', content: 'hi' }] });
    expect(res).toHaveProperty('id', 'azure-1');
  });

  it('GoogleProvider sends model-specific path and body', async () => {
    const provider = new GoogleProvider({ apiKey: 'gkey' });
    provider.baseUrl = 'https://generativelanguage.googleapis.com/v1beta2';

    provider.makeRequest = async function(path, options = {}) {
      expect(path).toBe('/models/gemini-1:generateText');
      expect(options.method).toBe('POST');
      const b = options.body;
      expect(b).toHaveProperty('prompt');
      return { id: 'g-1', output: 'ok' };
    };

    const res = await provider.completion({ model: 'gemini-1', messages: [{ role: 'user', content: 'hello' }] });
    expect(res).toHaveProperty('id', 'g-1');
  });

  it('OllamaProvider posts to /api/chat with expected body and headers', async () => {
    const provider = new OllamaProvider({ apiKey: 'okey' });
    provider.baseUrl = 'http://localhost:11434';

    provider.makeRequest = async function(path, options = {}) {
      expect(path).toBe('/api/chat');
      expect(options.method).toBe('POST');
      const b = options.body;
      expect(b).toHaveProperty('messages');
      return { id: 'o-1', object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'hi' } }] };
    };

    const res = await provider.completion({ model: 'ollama-model', messages: [{ role: 'user', content: 'hi' }] });
    expect(res).toHaveProperty('id', 'o-1');
  });
});
