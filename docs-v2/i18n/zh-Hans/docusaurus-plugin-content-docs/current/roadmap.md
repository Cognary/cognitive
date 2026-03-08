---
sidebar_position: 2
title: Roadmap
---

# Roadmap

Cognitive 现在按三步收敛：

- 默认路径尽量小
- 合同表面保持强约束
- 高级能力只在需要时才出现

仓库根目录下的 `ROADMAP.md` 是正式版本，这个页面主要用于文档站导航与阅读。

## 当前状态

当前阶段：**v2.2.x - 稳定与收紧**

最近完成：

- 首次体验路径已统一到 `npx cogn@<version> core run`
- 稳定 provider 表面已收敛到 6 个
- policy 与 structured output 降级决策可以在 verbose 输出中看到
- 重复 `@call:` 替换改成按原始位置处理，不再是“只替换第一个”
- `docs-v2` build 已纳入 `release:check`
- Anthropic streaming usage 统计现在能正确保留 input/output token
- 稳定 provider 的 request-shaping 测试已覆盖完整支持面
- alias 包（`packages/cogn`）现在会先跑主 runtime 的 release gate

接下来的直接动作：

- 默认路径和结构化路径 smoke test 通过后再发下一个 npm 版本

## 产品方向

Cognitive 不打算成为一个通用 AI 框架。

它更合适的定位是：

**面向 AI 任务的可验证、可迁移、可发布的合同运行时**

所以路线图优先关注：

- 稳定的 envelope 合同
- 不会打爆用户工作流的 provider 差异处理
- 通过 `core`、`standard`、`certified` 实现渐进复杂
- 可发布产物、一致性测试与审计能力

## v2.2.x - 稳定与收紧

目标：让当前系统足够稳定，可以放心发布。

优先事项：

- 关闭合同一致性缺陷
- 保持 `core run` 是唯一的首次体验入口
- 让 provider 降级行为安全且可解释
- 保持严格发布门禁：build、docs、conformance、pack check

退出条件：

- 发布流程可重复
- docs 和 CLI 讲的是同一套故事
- 稳定 provider 不会破坏默认路径

## v2.3 - 把产品讲清楚

目标：不只是技术上能用，而是让用户容易理解。

优先事项：

- 把 `core`、`standard`、`certified` 讲明白
- 围绕 PR review、结构化决策等 Killer Use Case 组织入口
- 文档优先按任务组织，而不是按内部子系统组织
- 解释 Cognitive 与 prompts、skills、MCP tools、通用 agent wrapper 的差异

退出条件：

- 新用户从首页就能理解产品
- 默认路径明显比协议表面更轻

## v2.4 - 打开协议表面

目标：让外部兼容实现真正可行。

优先事项：

- 发布最小合同集合
- 提供 provider 扩展指南与最小兼容测试
- 稳定 registry 产物行为与远端校验诊断
- 让兼容性可以被测试，而不是靠口头说明

退出条件：

- 第三方可以以合理成本实现兼容 provider 或 runtime
- 兼容性可以被直接验证

## 阅读完整计划

- 仓库路线图：`ROADMAP.md`
- 继续阅读：
  - [渐进复杂（升级触发器）](./getting-started/progressive-complexity)
  - [Killer Use Case](./getting-started/use-cases)
  - [一致性中心](./conformance)
