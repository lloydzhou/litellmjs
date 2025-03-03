import liteLLM from './src/litellm.js';

// 显示当前日期和时间
console.log(`Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`);
console.log('');

// 注册提供商
liteLLM.registerProvider('openai', {
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
});

liteLLM.registerProvider('anthropic', {
  apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key'
});

console.log('已注册提供商: openai, anthropic');

// 创建普通代理
liteLLM.createProxy({
  name: 'standard-proxy',
  url: 'https://your-litellm-proxy-url.com',
  models: ['proxy-model'],
});

// 创建带有 proxyModel 的代理
liteLLM.createProxy({
  name: 'deepseek',
  url: 'https://api.deepseek.com',
  models: ['gpt-4-proxy'],
  proxyModel: 'deepseek-chat',
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
  }
});

async function testProviderForModel() {
  console.log('\n测试 getProviderForModel 函数:');
  
  const testModels = [
    'gpt-3.5-turbo',
    'openai/gpt-3.5-turbo',
    'claude-2',
    'anthropic/claude-2',
    'proxy-model',  // 使用标准代理，不替换模型名称
    'gpt-4-proxy'   // 使用 deepseek 代理，替换为 'deepseek-chat'
  ];
  
  for (const model of testModels) {
    const { provider, actualModel } = liteLLM.getProviderForModel(model);
    
    let providerName = '未找到提供商';
    
    if (provider) {
      if (provider.isProxy) {
        providerName = `代理提供商 (${provider.proxyName})`;
      } else if (provider.constructor && provider.constructor.providerType) {
        providerName = provider.constructor.providerType;
      } else {
        providerName = '未知提供商类型';
      }
    }
    
    console.log(`模型 "${model}" -> 提供商: ${providerName}, 实际模型: ${actualModel}`);
  }
}

async function testFormatCompatibility() {
  console.log('\n测试各提供商响应格式兼容性:');
  
  const testCases = [
    {
      title: '1. OpenAI 基本响应',
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'user', content: '你好' }
      ]
    },
    {
      title: '2. Anthropic 基本响应',
      model: 'anthropic/claude-2',
      messages: [
        { role: 'user', content: '你好' }
      ]
    },
    {
      title: '3. OpenAI 函数调用',
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'user', content: '今天北京的天气怎么样？' }
      ],
      functions: [
        {
          name: 'get_weather',
          description: '获取指定地点的天气',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: '地点，如北京、上海等'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: '温度单位'
              }
            },
            required: ['location']
          }
        }
      ]
    },
    {
      title: '4. Anthropic 工具调用',
      model: 'anthropic/claude-3-5-haiku-20241022',
      messages: [
        { role: 'user', content: '今天北京的天气怎么样？' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: '获取指定地点的天气',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: '地点，如北京、上海等'
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: '温度单位'
                }
              },
              required: ['location']
            }
          }
        }
      ]
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${testCase.title}:`);
    
    try {
      delete testCase.title;
      const response = await liteLLM.completion(testCase);
      console.log(`响应: ${JSON.stringify(response)}`);
      // 验证响应格式是否符合 OpenAI 格式
      const isValidFormat = 
        response.id && 
        response.object === 'chat.completion' && 
        Array.isArray(response.choices) &&
        response.choices.length > 0 &&
        response.choices[0].message &&
        (response.choices[0].message.role === 'assistant') &&
        (response.choices[0].message.content !== undefined || response.choices[0].message.function_call);
      
      console.log(`响应格式有效: ${isValidFormat}`);
      console.log(`响应对象: ${response.object}`);
      console.log(`响应角色: ${response.choices[0].message.role}`);
      
      if (response.choices[0].message.function_call) {
        console.log(`函数调用: ${response.choices[0].message.function_call.name}`);
        console.log(`函数参数: ${response.choices[0].message.function_call.arguments}`);
      } else {
        console.log(`内容前20个字符: ${(response.choices[0].message.content || '').substring(0, 20)}...`);
      }
      
      console.log(`完成原因: ${response.choices[0].finish_reason}`);
      console.log(`Token计数存在: ${!!response.usage}`);
      
    } catch (error) {
      console.error(error);
      console.log(`错误: ${error.message}`);
    }
  }
}

async function testStreamingFormatCompatibility() {
  console.log('\n测试流式响应格式兼容性:');
  
  const testCases = [
    {
      title: '1. OpenAI 流式响应',
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'user', content: '用三个词形容春天' }
      ]
    },
    {
      title: '2. Anthropic 流式响应',
      model: 'anthropic/claude-2',
      messages: [
        { role: 'user', content: '用三个词形容春天' }
      ]
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${testCase.title}:`);
    
    try {
      let chunkCount = 0;
      let firstChunk = null;
      let lastChunk = null;
      
      console.log('开始流式输出...');
      
      for await (const chunk of liteLLM.streamCompletion(testCase)) {
        chunkCount++;
        
        if (!firstChunk) {
          firstChunk = chunk;
        }
        
        lastChunk = chunk;
        
        // 验证每个块是否符合 OpenAI 流式格式
        const isValidFormat = 
          chunk.id && 
          chunk.object === 'chat.completion.chunk' && 
          Array.isArray(chunk.choices);
          
        if (!isValidFormat) {
          console.log(`无效块格式: ${JSON.stringify(chunk)}`);
        }
        
        // 输出内容片段
        if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
          process.stdout.write(chunk.choices[0].delta.content);
        }
      }
      
      console.log('\n');
      console.log(`总块数: ${chunkCount}`);
      console.log(`第一个块格式有效: ${firstChunk && firstChunk.object === 'chat.completion.chunk'}`);
      console.log(`最后一个块格式有效: ${lastChunk && lastChunk.object === 'chat.completion.chunk'}`);
      console.log(`最后一个块完成原因: ${lastChunk && lastChunk.choices[0].finish_reason}`);
      
    } catch (error) {
      console.log(`错误: ${error.message}`);
    }
  }
}

async function testDeepseekProxy() {
  console.log('\n测试 Deepseek 代理:');
  for await (const chunk of liteLLM.streamCompletion({
    model: 'gpt-4-proxy',
    messages: [
      { role: 'user', content: '你好' }
    ]
  })) {
    if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
      process.stdout.write(chunk.choices[0].delta.content);
    }
  }
}

// 运行测试
async function runTests() {
  await testProviderForModel();
  await testFormatCompatibility();
  await testStreamingFormatCompatibility();
  await testDeepseekProxy();
}

runTests();