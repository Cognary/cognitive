---
sidebar_position: 3
---

# 一致性测试

使用官方测试向量验证运行时是否符合 Cognitive 2.2.7。

## 推荐方式（CLI）

使用参考 CLI 跑官方向量（离线、确定性）：

```bash
# 最小合同（Level 1，仅 envelope）
npx cogn@<version> test --conformance --suite envelope --level 1

# 完整合同（Level 3，envelope + stream + registry）
npx cogn@<version> test --conformance --suite all --level 3 --verbose
```

如果你不在 repo 根目录运行，可以显式传入 `--spec-dir`：

```bash
npx cogn@<version> test --conformance --spec-dir /path/to/cognitive --suite all --level 3
```

## 测试重点

- 合法成功 envelope
- 合法失败 envelope
- 非法 payload 拒绝
- 分层与策略约束生效
- 组合/上下文行为（若实现）

## 建议流程

1. 跑完全部 Level 1 向量。
2. 实现了分层/策略后，跑 Level 2。
3. 实现了组合/上下文后，跑 Level 3。
4. 在 CI 中保留 pass/fail 证据。

## 权威来源

- `CONFORMANCE-TESTING.md`
- `spec/test-vectors/README.md`
