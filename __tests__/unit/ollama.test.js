import { describe, it, expect } from 'vitest';
import OllamaProvider from '../../src/providers/ollama.js';

function makeAsyncBody(chunks) {
  return Object.assign((async function*(){
    for (const c of chunks) yield c;
  })(), { on: () => {} });
}

describe('OllamaProvider', () => {
  it('completion forwards to /api/chat', async () => {
    const p = new OllamaProvider({});
    p.makeRequest = async (path, opts) => {
      expect(path).toBe('/api/chat');
      return { id: 'o1', object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'hi' } }] };
    };

    const res = await p.completion({ model: 'ollama-model', messages: [] });
    expect(res).toHaveProperty('id', 'o1');
  });

  it('streamCompletion yields chunks from SSE-like body', async () => {
    const p = new OllamaProvider({});
    const sse = 'data: {"x":1}\n';
    p.makeRequest = async (path, opts) => ({ body: makeAsyncBody([Buffer.from(sse)]) });

    const out = [];
    for await (const chunk of p.streamCompletion({ model: 'ollama-model', messages: [] })) out.push(chunk);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]).toEqual({ x: 1 });
  });
});
