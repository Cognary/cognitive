---
sidebar_position: 7
---

# 模块测试（Golden Tests）

v2.2 支持 golden tests 作为规范格式。Node CLI 当前 **没有内置测试命令**，但测试格式稳定，可用自定义脚本执行。

## 目录结构

```
my-module/
├── module.yaml
├── prompt.md
├── schema.json
└── tests/
    ├── case1.input.json
    └── case1.expected.json
```

## 输入文件

```json
{
  "query": "review this code"
}
```

## 期望文件

### 1) 精确匹配

```json
{
  "ok": true,
  "data": {
    "summary": "..."
  }
}
```

### 2) 校验规则

```json
{
  "_validate": {
    "required": ["ok", "meta", "data"],
    "confidence_min": 0.7
  }
}
```

## 建议

- 使用 `npx cogn@2.2.13 validate` 做结构校验
- CI 中可调用 `npx cogn@2.2.13 run` 并对比期望文件
