# Cognitive Modules 使用指南

本项目使用 Cognitive Modules 生成结构化规范。

---

## UI 规范生成

当用户要求生成 UI 规范、设计页面结构、定义组件、或做产品页面时：

### 步骤

1. **读取指令**：读取 `~/.cognitive/modules/ui-spec-generator/prompt.txt` 作为系统指令
2. **读取输出格式**：读取 `~/.cognitive/modules/ui-spec-generator/output.schema.json` 了解输出结构
3. **读取约束**：读取 `~/.cognitive/modules/ui-spec-generator/constraints.yaml` 了解限制条件
4. **生成规范**：根据用户需求生成符合 schema 的 JSON
5. **保存输出**：将结果保存到 `ui-spec.json`

### 输出要求

输出必须是有效 JSON，包含：
- `specification`：完整 UI 规范（信息架构、组件、交互、响应式、可访问性、验收标准）
- `rationale`：设计决策说明和假设
- `confidence`：置信度 0-1

### 约束

- 不生成实现代码
- 不编造未提供的需求（标记为 unknown）
- 不凭空创造品牌标识
- 设计令牌如未提供，标记 status: "unknown"

---

## 示例调用

用户说："为一个健康产品官网生成 UI 规范，产品是情绪压力复原力保健食品，目标用户 25-45 岁精英人群"

你应该：
1. 读取上述文件
2. 按 prompt.txt 的流程分析需求
3. 生成符合 output.schema.json 的完整规范
4. 保存到 ui-spec.json
