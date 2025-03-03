import liteLLM from './src/litellm.js';

// 显示当前日期和时间
console.log(`Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`);
console.log(`Current User's Login: lloydzhou`);
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

async function testProxyModelReplacement() {
  console.log('\n测试代理模型替换:');
  
  // 模拟 completion 函数，不实际发送请求
  const mockCompletion = (model, options) => {
    const { provider, actualModel } = liteLLM.getProviderForModel(model);
    
    let providerName = '未找到提供商';
    
    if (provider) {
      if (provider.isProxy) {
        providerName = `代理提供商 (${provider.proxyName})`;
      } else if (provider.constructor && provider.constructor.providerType) {
        providerName = provider.constructor.providerType;
      }
    }
    
    return {
      provider: providerName,
      requestedModel: model,
      actualModel: actualModel,
      messages: options.messages
    };
  };

  // 测试不同模型
  const testCases = [
    { model: 'gpt-3.5-turbo', message: 'OpenAI 模型' },
    { model: 'claude-2', message: 'Anthropic 模型' },
    { model: 'proxy-model', message: '标准代理 (不替换模型)' },
    { model: 'gpt-4-proxy', message: 'DeepSeek 代理 (替换为 deepseek-chat)' }
  ];

  for (const { model, message } of testCases) {
    console.log(`\n测试 "${model}" (${message}):`);
    const result = mockCompletion(model, {
      messages: [{ role: 'user', content: '测试消息' }]
    });
    
    console.log(`- 请求的模型: ${result.requestedModel}`);
    console.log(`- 提供商: ${result.provider}`);
    console.log(`- 实际使用的模型: ${result.actualModel}`);
  }
}

async function testStreamCompletion() {
  try {
    console.log('\n测试流式完成请求:');

    // 使用提供商前缀的流式输出
    console.log('开始流式输出...');
    for await (const chunk of liteLLM.streamCompletion({
      model: 'deepseek/gpt-4-proxy',
      messages: [
        { role: 'user', content: '简短介绍JavaScript。' }
      ]
    })) {
      if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
        process.stdout.write(chunk.choices[0].delta.content);
      }
    }
    console.log('\n流式输出完成');

  } catch (error) {
    console.error('流式完成请求过程中发生错误:', error);
  }
}

// 运行测试
async function runTests() {
  await testProviderForModel();
  await testProxyModelReplacement();
  await testStreamCompletion();
}

runTests();
