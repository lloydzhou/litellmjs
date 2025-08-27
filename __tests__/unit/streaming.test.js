import { describe, it, expect } from 'vitest';
import OpenAIProvider from '../../src/providers/openai.js';
import AnthropicProvider from '../../src/providers/anthropic.js';

function collectGenerator(gen) {
  const out = [];
  for (const v of gen) out.push(v);
  return out;
}

describe('stream parsing - OpenAI _processChunk (generator) and Anthropic _processChunk (array)', () => {
  const openai = new OpenAIProvider({ apiKey: 'x' });
  const anthropic = new AnthropicProvider({ apiKey: 'x' });

  it('parses multiple data lines into objects', () => {
    const chunk = 'data: {"a":1}\ndata: {"b":2}\n';
    // OpenAI generator
    const openaiResult = collectGenerator(openai._processChunk(chunk));
    expect(openaiResult.length).toBe(2);
    expect(openaiResult[0]).toEqual({ a: 1 });
    expect(openaiResult[1]).toEqual({ b: 2 });

    // Anthropic array
    const anthropicResult = anthropic._processChunk(chunk);
    expect(Array.isArray(anthropicResult)).toBe(true);
    expect(anthropicResult.length).toBe(2);
  });

  it('handles [DONE] marker by terminating/ignoring appropriately', () => {
    const chunk = 'data: {"a":1}\ndata: [DONE]\n';
    const openaiResult = collectGenerator(openai._processChunk(chunk));
    // OpenAI implementation returns (stops) on [DONE] and yields previous objects
    expect(openaiResult.length).toBe(1);
    expect(openaiResult[0]).toEqual({ a: 1 });
  const anthropicResult = anthropic._processChunk(chunk);
  // unified behavior: treat [DONE] as end-of-stream
  expect(anthropicResult.length).toBe(1);
  expect(anthropicResult[0]).toEqual({ a: 1 });
  });

  it('invalid JSON lines do not throw and produce no parsed objects', () => {
    const bad = 'data: {invalid json}\n';
    const openaiResult = collectGenerator(openai._processChunk(bad));
    expect(openaiResult.length).toBe(0);
  const anthropicResult = anthropic._processChunk(bad);
  expect(anthropicResult.length).toBe(0);

  // parse errors should be recorded
  expect(openai._parseErrors.length).toBeGreaterThanOrEqual(1);
  expect(anthropic._parseErrors.length).toBeGreaterThanOrEqual(1);
  });

  it('partial JSON across chunks is buffered and parsed when complete', () => {
    const part1 = 'data: {"a":';
    const part2 = '1}\n';

    const r1 = collectGenerator(openai._processChunk(part1));
    // first call should not yield yet
    expect(r1.length).toBe(0);

    const r2 = collectGenerator(openai._processChunk(part2));
    // combined across calls, should produce one object
    expect(r2.length + r1.length).toBe(1);
    expect(r2[0] || r1[0]).toEqual({ a: 1 });

    const a1 = anthropic._processChunk(part1);
    expect(a1.length).toBe(0);
    const a2 = anthropic._processChunk(part2);
    expect(a2.length + a1.length).toBe(1);
  });

  it('Anthropic _convertStreamChunkToOpenAIFormat maps text_delta and tool_use', () => {
    const textChunk = { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hello' } };
    const mapped = anthropic._convertStreamChunkToOpenAIFormat(textChunk, { model: 'claude-2' });
    expect(mapped).toHaveProperty('choices');
    expect(mapped.choices[0].delta.content).toBe('hello');

    const toolChunk = { type: 'content_block_delta', delta: { type: 'tool_use', name: 'get_weather', input: { q: 'beijing' } } };
    const mappedTool = anthropic._convertStreamChunkToOpenAIFormat(toolChunk, { model: 'claude-2' });
    expect(mappedTool.choices[0].delta.function_call).toBeDefined();
    expect(mappedTool.choices[0].finish_reason).toBe('function_call');
  });
});
