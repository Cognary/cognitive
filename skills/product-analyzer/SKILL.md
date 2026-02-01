# Product Analyzer

产品分析，结合 UI 规范生成完整的产品设计方案。

## 何时使用

当用户需要全面的产品分析，包括市场定位、功能规划、UI 规范时，使用此 Skill。

## 使用方法

```bash
cog run product-analyzer --args "产品描述" --subagent --pretty
```

注意：此模块使用 `--subagent` 模式，会自动调用 `ui-spec-generator` 子模块。

## 输入

描述产品概念，包括：
- 产品类型
- 目标用户
- 核心功能

## 输出

JSON 格式，包含：

- `analysis`: 产品分析（市场定位、竞品、用户画像）
- `ui_spec`: UI 规范（来自子模块）
- `recommendations`: 建议和后续步骤
- `confidence`: 0-1 之间的置信度
- `rationale`: 分析依据

## 示例

```bash
cog run product-analyzer --args "面向年轻人的健康食品电商平台" --subagent --pretty
```

## 注意事项

- 这是一个 Cognitive Module 的 Skill 包装
- 使用子代理模式，会调用其他模块
- 需要先安装：`pip install cognitive-modules`
- 需要配置 LLM
