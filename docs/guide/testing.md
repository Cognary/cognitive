# 模块测试

Cognitive Modules 支持 Golden Test（黄金测试）来验证模块行为。

## Golden Test 概念

Golden Test 是一种基于已知输入输出对的测试方法：

1. **输入文件**: `tests/case1.input.json` - 模块输入
2. **期望文件**: `tests/case1.expected.json` - 期望输出或验证规则

```
code-simplifier/
├── module.yaml
├── prompt.md
├── schema.json
└── tests/
    ├── case1.input.json
    ├── case1.expected.json
    ├── case2.input.json
    └── case2.expected.json
```

## 测试文件格式

### 输入文件

标准 JSON，符合模块的 `input` schema：

```json
// tests/case1.input.json
{
  "code": "x = 1 + 2 + 3",
  "language": "python"
}
```

### 期望文件

有两种模式：

#### 模式 1: 精确匹配

```json
// tests/case1.expected.json
{
  "simplified": "x = 6",
  "behavior_equivalence": true,
  "confidence": 0.99
}
```

#### 模式 2: 验证规则（推荐）

```json
// tests/case1.expected.json
{
  "_validate": {
    "required": ["simplified", "behavior_equivalence", "confidence"],
    "behavior_equivalence": true,
    "confidence_min": 0.8,
    "confidence_max": 1.0
  }
}
```

### 验证规则字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `required` | 必须存在的字段 | `["simplified", "confidence"]` |
| `<field>` | 字段精确值 | `"behavior_equivalence": true` |
| `<field>_min` | 数值最小值 | `"confidence_min": 0.8` |
| `<field>_max` | 数值最大值 | `"confidence_max": 1.0` |
| `<field>_contains` | 字符串包含 | `"rationale_contains": "constant"` |
| `<field>_matches` | 正则匹配 | `"simplified_matches": "^x\\s*="` |

## 运行测试

### CLI 命令

```bash
# 测试单个模块
cog test code-simplifier

# 测试所有模块
cog test --all

# 详细输出
cog test code-simplifier --verbose

# 指定 Provider
cog test code-simplifier --provider openai
```

### 输出示例

```
Testing code-simplifier...

  ✓ case1: constant folding (0.95)
  ✓ case2: loop simplification (0.88)
  ✗ case3: complex refactor
    Expected: behavior_equivalence = true
    Actual:   behavior_equivalence = false
    Rationale: "Cannot guarantee equivalence for async code"

Results: 2/3 passed
```

## 编写好的测试

### 1. 覆盖边界情况

```json
// tests/empty-input.input.json
{
  "code": "",
  "language": "python"
}
```

```json
// tests/empty-input.expected.json
{
  "_validate": {
    "required": ["error"],
    "error.code": "INVALID_INPUT"
  }
}
```

### 2. 测试行为等价性

```json
// tests/must-preserve-behavior.input.json
{
  "code": "def add(a, b): return a + b",
  "language": "python"
}
```

```json
// tests/must-preserve-behavior.expected.json
{
  "_validate": {
    "required": ["simplified", "behavior_equivalence"],
    "behavior_equivalence": true
  }
}
```

### 3. 测试风险评估

```json
// tests/risky-change.expected.json
{
  "_validate": {
    "required": ["changes"],
    "changes[0].risk_not": "high"
  }
}
```

## 程序化测试

### Python

```python
from cognitive.testing import run_tests, TestResult

results: list[TestResult] = run_tests('code-simplifier')

for result in results:
    print(f"{result.case_name}: {'✓' if result.passed else '✗'}")
    if not result.passed:
        print(f"  Expected: {result.expected}")
        print(f"  Actual:   {result.actual}")
        print(f"  Error:    {result.error}")
```

### TypeScript

```typescript
import { runTests, TestResult } from 'cognitive-runtime';

const results: TestResult[] = await runTests('./modules/code-simplifier');

for (const result of results) {
  console.log(`${result.caseName}: ${result.passed ? '✓' : '✗'}`);
  if (!result.passed) {
    console.log(`  Expected: ${JSON.stringify(result.expected)}`);
    console.log(`  Actual:   ${JSON.stringify(result.actual)}`);
  }
}
```

## CI 集成

### GitHub Actions

```yaml
# .github/workflows/test-modules.yml
name: Test Cognitive Modules

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install cognitive-modules
      
      - name: Run module tests
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: cog test --all --ci
```

### 输出格式

```bash
# JUnit XML 格式（CI 友好）
cog test --all --format junit > test-results.xml

# JSON 格式
cog test --all --format json > test-results.json
```

## 最佳实践

1. **每个模块至少 3 个测试用例**
   - 正常输入
   - 边界情况
   - 错误情况

2. **使用验证规则而非精确匹配**
   - LLM 输出有随机性
   - 验证结构和约束，而非精确字符串

3. **测试行为等价性**
   - 对于代码转换模块，`behavior_equivalence` 是关键断言

4. **测试失败契约**
   - 验证错误时返回正确的 `error` 格式

5. **定期运行**
   - 在 CI 中运行，确保模块质量
