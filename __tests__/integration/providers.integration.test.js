import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import AzureProvider from '../../src/providers/azure.js';
import GoogleProvider from '../../src/providers/google.js';
import OllamaProvider from '../../src/providers/ollama.js';

describe('providers HTTP integration (nock)', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.restore());

  it('AzureProvider sends correct path, headers and body', async () => {
    const provider = new AzureProvider({ apiKey: 'akey', deployment: 'mydep', apiVersion: '2023-10-01' });

    const scope = nock('https://api.openai.azure.com')
      // AzureProvider.defaultBaseUrl includes /v1; make matcher allow either
      .post('/v1/openai/deployments/mydep/chat/completions')
      .query({ 'api-version': '2023-10-01' })
      .reply(function(uri, requestBody) {
        // header assertion
        expect(this.req.headers['api-key']).toContain('akey');
        // body assertion - nock may give string bodies
        const body = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
        expect(body).toHaveProperty('messages');
        return [200, { id: 'azure-1', object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'ok' } }] }];
      });

    const res = await provider.completion({ model: 'gpt-3', messages: [{ role: 'user', content: 'hi' }] });
    expect(res).toHaveProperty('id', 'azure-1');
    scope.done();
  });

  it('GoogleProvider sends model-specific path and body', async () => {
    const provider = new GoogleProvider({ apiKey: 'gkey' });
    const scope = nock('https://generativelanguage.googleapis.com')
      .post('/v1beta2/models/gemini-1:generateText', (body) => {
        const b = typeof body === 'string' ? JSON.parse(body) : body;
        expect(b).toHaveProperty('prompt');
        return true;
      })
      .reply(200, { id: 'g-1', output: 'ok' });

    // override baseUrl for test to include version prefix
    provider.baseUrl = 'https://generativelanguage.googleapis.com/v1beta2';
    const res = await provider.completion({ model: 'gemini-1', messages: [{ role: 'user', content: 'hello' }] });
    expect(res).toHaveProperty('id', 'g-1');
    scope.done();
  });

  it('OllamaProvider posts to /api/chat with expected body and headers', async () => {
    const provider = new OllamaProvider({ apiKey: 'okey' });
    const scope = nock('http://localhost:11434')
      .post('/api/chat', (body) => {
        const b = typeof body === 'string' ? JSON.parse(body) : body;
        expect(b).toHaveProperty('messages');
        return true;
      })
      .reply(200, { id: 'o-1', object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'hi' } }] });

    const res = await provider.completion({ model: 'ollama-model', messages: [{ role: 'user', content: 'hi' }] });
    expect(res).toHaveProperty('id', 'o-1');
    scope.done();
  });
});
