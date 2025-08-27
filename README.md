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

  ```

  ### 使用 `provider/model` 语法

  LiteLLM-JS 支持像 Python 版本那样的 `provider/model` 命名格式，用来显式指定提供商。例如：

  ```javascript
  // 显式指定使用 openai 提供商的 gpt-3.5 模型
  const response = await liteLLM.completion({
    model: 'openai/gpt-3.5-turbo',
    messages: [{ role: 'user', content: '介绍 JavaScript 的事件循环' }]
  });

  // 或者直接用 model 名称（自动按前缀或已注册的 provider 匹配）
  const resp2 = await liteLLM.completion({ model: 'gpt-3.5-turbo', messages: [...] });
  ```

  当你使用 `provider/model` 语法时，LiteLLM 会优先使用你通过 `liteLLM.registerProvider('provider', opts)` 注册的对应提供商实例。

  如果需要为某些模型走代理，请使用 `createProxy()` 并在 proxy 的 `models` 列表中包含具体的 model 名（或使用 `'*'` 全部匹配）。

### 注册多个同类 provider（例如多实例 Ollama）并路由示例

有时你会在不同主机上运行多个同类型的 LLM 服务（例如在 east/west 两个机房都部署了 Ollama）。LiteLLM-JS 支持为相同 provider type 注册多个命名实例，并可通过 `provider/model` 或 `registerModelRoute` 基于模型前缀路由到具体实例。

```javascript
import liteLLM from 'litellm-js';

liteLLM.registerProvider('ollama', { name: 'ollama-east', baseUrl: 'http://east:11434' });
liteLLM.registerProvider('ollama', { name: 'ollama-west', baseUrl: 'http://west:11434' });

// 显式使用某个实例
await liteLLM.completion({ model: 'ollama-east/my-model', messages: [{ role: 'user', content: '你好' }] });

// 或者根据模型前缀自动路由
liteLLM.registerModelRoute('east-', 'ollama-east');
await liteLLM.completion({ model: 'east-alpha', messages: [{ role: 'user', content: '你好 east' }] });

// 列出当前注册的 provider
console.log(liteLLM.getRegisteredProviders());
```

  ## 与 Python 版本 LiteLLM 的兼容性说明

  以下列出了当前 JavaScript 版本实现的功能与 Python 版本的对齐情况，以及已知差异：

  - 已实现（与 Python 版本相同或等效）
    - 多提供商统一接口（OpenAI、Anthropic、Azure、Google、Ollama）。
    - 代理模式（`createProxy` / `registerProxy`）支持。
    - 流式输出（streaming）支持，包含对 SSE/text-event-stream 的缓冲和跨 chunk 拼接。
    - 在浏览器与 Node.js 环境中均可运行（使用 fetch / cross-fetch）。
    - 支持 `provider/model` 显式指定提供商。

  - 局限或尚未完全覆盖的点（可能与 Python 版行为不同）
    - Google (Gemini/PaLM) 的请求/响应映射为简化实现，还未完全覆盖 Google GenAI 的全部请求字段和原生 streaming 协议。
    - Azure OpenAI 的某些部署/版本边界情况需要按需传入 `deployment` 或 `apiVersion`（JS 版需要通过 provider options 或每次请求传入）。
    - 函数调用（function_call）与工具调用（tool use）的语义：核心映射已存在于部分 provider，但不同 provider 间的 edge-case 仍需更多测试。
    - 高级认证、重试策略、速率限制与企业级集成（这些通常由上层应用或代理来处理）。

  如果你依赖 Python 版的某个具体行为，请告诉我哪些用例最关键，我可以优先把这些行为在 JS 版本中补齐并添加对应单元/集成测试。
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