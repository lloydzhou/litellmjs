export function makeOpenAIMock() {
  return {
    providerType: 'openai',
    supportsModel: (m) => m && m.includes('gpt'),
    completion: async (opts) => {
      return {
        id: 'mock-openai-1',
        object: 'chat.completion',
        choices: [{
          message: { role: 'assistant', content: '这是 OpenAI 模拟响应。' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 1, completion_tokens: 3 }
      };
    },
    streamCompletion: async function* (opts) {
      // yield a couple of chunks that look like parsed SSE JSON objects
      yield { id: 'stream-1', object: 'chat.completion.chunk', choices: [{ delta: { content: '这' } }] };
      await new Promise((r) => setTimeout(r, 5));
      yield { id: 'stream-1', object: 'chat.completion.chunk', choices: [{ delta: { content: '是' } }] };
      await new Promise((r) => setTimeout(r, 5));
      yield { id: 'stream-1', object: 'chat.completion.chunk', choices: [{ delta: { content: '流' }, finish_reason: 'stop' }] };
    }
  };
}

export function makeAnthropicMock() {
  return {
    providerType: 'anthropic',
    supportsModel: (m) => m && m.includes('claude'),
    completion: async (opts) => {
      return {
        id: 'mock-anthropic-1',
        object: 'chat.completion',
        choices: [{
          message: { role: 'assistant', content: '这是 Anthropic 模拟响应。' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 2, completion_tokens: 4 }
      };
    },
    streamCompletion: async function* (opts) {
      yield { id: 'astream-1', object: 'chat.completion.chunk', choices: [{ delta: { content: '安' } }] };
      await new Promise((r) => setTimeout(r, 5));
      yield { id: 'astream-1', object: 'chat.completion.chunk', choices: [{ delta: { content: '然' } }] };
      await new Promise((r) => setTimeout(r, 5));
      yield { id: 'astream-1', object: 'chat.completion.chunk', choices: [{ delta: { content: '流' }, finish_reason: 'stop' }] };
    }
  };
}
