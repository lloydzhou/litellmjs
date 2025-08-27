import { describe, it, expect } from 'vitest';
import GoogleProvider from '../../src/providers/google.js';

describe('GoogleProvider', () => {
  it('completion forwards to makeRequest and returns response', async () => {
    const p = new GoogleProvider({ apiKey: 'gkey' });
    p.makeRequest = async (path, opts) => {
      // Google provider currently includes the model name in the path
      expect(path).toBe('/models/gemini-1:generateText');
      return { id: 'g1', output: 'generated' };
    };

    const res = await p.completion({ model: 'gemini-1', messages: [] });
    expect(res).toHaveProperty('id', 'g1');
  });

  it('streamCompletion falls back to a single chunk', async () => {
    const p = new GoogleProvider({ apiKey: 'gkey' });
    p.completion = async (opts) => ({ id: 'g2', object: 'chat.completion', choices: [{ message: { role: 'assistant', content: 'ok' } }] });

    const out = [];
    for await (const c of p.streamCompletion({ model: 'gemini-1', messages: [] })) out.push(c);
    expect(out.length).toBe(1);
    expect(out[0]).toHaveProperty('id', 'g2');
  });
});
