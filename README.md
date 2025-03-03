# LiteLLM-JS

JavaScript 版本的 [LiteLLM](https://github.com/BerriAI/litellm)，提供统一的接口来访问不同的大型语言模型 API。

## 特点

- 支持多种 LLM 提供商（OpenAI, Anthropic, 等）
- 代理模式支持
- 完全兼容浏览器和 Node.js 环境
- 支持流式输出
- 简单、一致的 API 接口

## 安装

```bash
npm install litellm-js
```

## 快速开始

### 基本使用

```javascript
import liteLLM from 'litellm-js';

// 注册提供商
liteLLM.registerProvider('openai', {
  apiKey: 'your-openai-api-key'
});

// 生成完成
const response = await liteLLM.completion({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: '你是一名有用的助手。' },
    { role: 'user', content: '告诉我关于 JavaScript 的知识。' }
  ]
});

console.log(response);

// 流式输出
for await (const chunk of liteLLM.streamCompletion({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: '你是一名有用的助手。' },
    { role: 'user', content: '告诉我关于 JavaScript 的知识。' }
  ]
})) {
  console.log(chunk);
}
```

### 使用代理

```javascript
import liteLLM from 'litellm-js';

// 创建代理
liteLLM.createProxy({
  name: 'my-proxy',
  url: 'http://localhost:8000',
  models: ['gpt-4', 'claude-2'], // 这些模型会通过代理路由
  headers: {
    'Authorization': 'Bearer your-proxy-key'
  }
});

// 通过代理使用模型
const response = await liteLLM.completion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '你好！' }]
});
```

## 支持的提供商

- OpenAI (GPT 系列模型)
- Anthropic (Claude 系列模型)
- Azure OpenAI
- Google (Gemini, PaLM)
- 更多提供商正在添加中...

## 高级用法

### 自定义基本 URL

```javascript
liteLLM.registerProvider('openai', {
  apiKey: 'your-openai-api-key',
  baseUrl: 'https://custom-openai-endpoint.com/v1'
});
```

### 设置默认参数

```javascript
liteLLM.registerProvider('anthropic', {
  apiKey: 'your-anthropic-api-key',
  defaultParams: {
    temperature: 0.5,
    max_tokens: 1000
  }
});
```

## 贡献

欢迎贡献！请随时提交 Pull Request 或创建 Issue 讨论新功能或报告问题。

## 许可

MIT