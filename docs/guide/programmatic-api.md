# 程序化 API

除了 CLI，你也可以在代码中直接调用 Cognitive Modules。

## Python API

### 基本用法

```python
from cognitive import run_module, find_module, load_module

# 方式 1: 直接运行（推荐）
result = run_module('code-reviewer', {
    'code': 'def foo(): pass',
    'language': 'python'
})

print(result['issues'])
print(result['confidence'])
print(result['rationale'])
```

### 分步调用

```python
from cognitive.loader import load_module, find_module
from cognitive.runner import build_prompt, call_llm, parse_response

# 1. 查找模块
module_path = find_module('code-simplifier')

# 2. 加载模块
module = load_module(module_path)

print(f"格式: {module['format']}")  # v2, v1, 或 v0
print(f"职责: {module['metadata'].get('responsibility')}")

# 3. 构建 Prompt
prompt = build_prompt(module, {
    'code': 'x = 1 + 2 + 3'
})

# 4. 调用 LLM
response = call_llm(prompt, module['output_schema'])

# 5. 解析响应
result = parse_response(response, module['output_schema'])
```

### 自定义 Provider

```python
from cognitive import run_module
from cognitive.providers import get_provider

# 使用特定 Provider
provider = get_provider('anthropic', model='claude-sonnet-4-20250514')

result = run_module('code-reviewer', 
    input_data={'code': 'def foo(): pass'},
    provider=provider
)
```

### 验证输入输出

```python
from cognitive.validator import validate_input, validate_output
from cognitive.loader import load_module

module = load_module('./cognitive/modules/code-simplifier')

# 验证输入
input_data = {'code': 'x = 1'}
errors = validate_input(input_data, module['input_schema'])
if errors:
    print(f"输入验证失败: {errors}")

# 验证输出
output_data = {'simplified': 'x = 1', 'confidence': 0.9}
errors = validate_output(output_data, module['output_schema'])
if errors:
    print(f"输出验证失败: {errors}")
```

---

## TypeScript API

### 基本用法

```typescript
import { runModule, loadModule, getProvider } from 'cognitive-runtime';

// 加载模块
const module = await loadModule('./cognitive/modules/code-simplifier');

// 获取 Provider
const provider = getProvider('gemini');

// 运行
const result = await runModule(module, provider, {
  code: 'x = 1 + 2 + 3',
  language: 'python'
});

console.log(result.simplified);
console.log(result.behavior_equivalence);
console.log(result.confidence);
```

### 类型定义

```typescript
interface CognitiveModule {
  name: string;
  version: string;
  format: 'v2' | 'v1' | 'v0';
  responsibility?: string;
  excludes?: string[];
  constraints?: ModuleConstraints;
  inputSchema: object;
  outputSchema: object;
  errorSchema?: object;
  prompt: string;
}

interface ModuleResult {
  [key: string]: any;
  rationale: string;
  confidence: number;
  behaviorEquivalence?: boolean;
}

interface Provider {
  name: string;
  invoke(params: InvokeParams): Promise<InvokeResult>;
}
```

### 自定义 Provider

```typescript
import { Provider, InvokeParams, InvokeResult } from 'cognitive-runtime';

class MyCustomProvider implements Provider {
  name = 'my-provider';
  
  async invoke(params: InvokeParams): Promise<InvokeResult> {
    // 调用你的 LLM API
    const response = await fetch('https://my-llm-api.com/v1/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: params.messages,
        response_format: { type: 'json_object' }
      })
    });
    
    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens
      }
    };
  }
}

// 使用自定义 Provider
const provider = new MyCustomProvider();
const result = await runModule(module, provider, input);
```

---

## 错误处理

### Python

```python
from cognitive import run_module
from cognitive.exceptions import (
    ModuleNotFoundError,
    ValidationError,
    ProviderError
)

try:
    result = run_module('code-simplifier', {'code': 'x = 1'})
except ModuleNotFoundError as e:
    print(f"模块未找到: {e}")
except ValidationError as e:
    print(f"验证失败: {e.errors}")
except ProviderError as e:
    print(f"LLM 调用失败: {e}")
```

### TypeScript

```typescript
import { runModule, ModuleNotFoundError, ValidationError } from 'cognitive-runtime';

try {
  const result = await runModule(module, provider, input);
} catch (error) {
  if (error instanceof ModuleNotFoundError) {
    console.error(`模块未找到: ${error.message}`);
  } else if (error instanceof ValidationError) {
    console.error(`验证失败: ${error.errors}`);
  } else {
    throw error;
  }
}
```

---

## 集成示例

### Express.js 服务

```typescript
import express from 'express';
import { loadModule, runModule, getProvider } from 'cognitive-runtime';

const app = express();
app.use(express.json());

// 预加载模块
const modules = new Map();
modules.set('code-simplifier', await loadModule('./modules/code-simplifier'));
modules.set('code-reviewer', await loadModule('./modules/code-reviewer'));

const provider = getProvider('openai');

app.post('/api/run/:moduleName', async (req, res) => {
  const { moduleName } = req.params;
  const module = modules.get(moduleName);
  
  if (!module) {
    return res.status(404).json({ error: 'Module not found' });
  }
  
  try {
    const result = await runModule(module, provider, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

### FastAPI 服务

```python
from fastapi import FastAPI, HTTPException
from cognitive import run_module
from cognitive.loader import load_module

app = FastAPI()

# 预加载模块
modules = {
    'code-simplifier': load_module('./cognitive/modules/code-simplifier'),
    'code-reviewer': load_module('./cognitive/modules/code-reviewer'),
}

@app.post("/api/run/{module_name}")
async def run(module_name: str, input_data: dict):
    if module_name not in modules:
        raise HTTPException(status_code=404, detail="Module not found")
    
    try:
        result = run_module(module_name, input_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```
