import { describe, it, expect } from 'vitest';
import AzureProvider from '../../src/providers/azure.js';

function makeAsyncBody(chunks) {
  return Object.assign((async function*(){
    for (const c of chunks) yield c;
  })(), { on: () => {} });
}

describe('AzureProvider', () => {
  it('completion forwards request and returns response', async () => {
    const p = new AzureProvider({ apiKey: 'key' });
    p.makeRequest = async (path, opts) => {
      // Azure provider builds a deployment-based path including api-version
      expect(path).toBe('/openai/deployments/gpt-3.5/chat/completions?api-version=2023-10-01');
      return {
        id: 'a1', object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }], usage: {}
      };
    };

    const res = await p.completion({ model: 'gpt-3.5', messages: [{ role: 'user', content: 'hi' }] });
    expect(res).toHaveProperty('id', 'a1');
    expect(res.object).toBe('chat.completion');
  });

  it('streamCompletion yields parsed chunks from SSE body', async () => {
    const p = new AzureProvider({ apiKey: 'key' });
    const sse = 'data: {"msg":"hi"}\n';
    p.makeRequest = async (path, opts) => ({ body: makeAsyncBody([Buffer.from(sse)]) });

    const out = [];
    for await (const chunk of p.streamCompletion({ model: 'gpt-3.5', messages: [] })) {
      out.push(chunk);
    }
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]).toEqual({ msg: 'hi' });
  });
});
