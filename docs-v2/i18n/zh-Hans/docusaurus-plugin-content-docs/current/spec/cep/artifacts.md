---
sidebar_position: 7
---

# 可迁移/可发布产物清单（Portable + Releasable）

要把 Cognitive 做成“协议化”（类似 OpenAPI / OpenTelemetry 的风格），靠代码不够。
你需要一组 **可迁移、可发布、可验证、可镜像** 的产物，才能被工具链长期消费。

本页给出 CEP 生态里“可迁移/可发布”的最小产物集合。

## 产物类型

### 1) Module Pack（模块包）

v2 模块本质是一个目录，至少包含：

- `module.yaml`（manifest）
- `prompt.md`（prompt 正文）
- `schema.json`（input/data/meta/error schemas）

可选但建议：

- `README.md`
- conformance 示例 / 测试向量

### 2) Registry Index（发现索引）

Registry 不一定要自建服务器。最小实现可以是：

- 一个静态 JSON index（GitHub Pages、S3 等均可）
- 条目列出模块名、版本、下载 URL
- 条目包含完整性字段：`sha256`、`size`、`created_at`

每条 entry 的最小推荐字段：

- `name`（string）
- `version`（string, semver）
- `format`（string，例如 `v2`）
- `url`（string，tarball 下载地址）
- `sha256`（string）
- `size`（number，bytes）
- `created_at`（string，ISO-8601）

示例：

```json
{
  "registry_version": "1",
  "generated_at": "2026-02-07T00:00:00Z",
  "entries": [
    {
      "name": "code-reviewer",
      "version": "2.2.7",
      "format": "v2",
      "url": "https://github.com/Cognary/cognitive/releases/download/v2.2.7/code-reviewer-2.2.7.tar.gz",
      "sha256": "…",
      "size": 12345,
      "created_at": "2026-02-07T00:00:00Z"
    }
  ]
}
```

### 3) GitHub Release Assets Tarballs（载体）

GitHub Release assets 可以承载不可变的模块 tarball。

推荐命名：

- `<module-name>-<version>.tar.gz`

推荐内容：

- `module.yaml`
- `prompt.md`
- `schema.json`
- `LICENSE`（如需要二次分发）

推荐配套元数据：

- `sha256`（写入 registry index）
- 可选签名（cosign / minisign）

## 为什么 tarball 必须跟版本一致

如果你发布了 Release `v2.2.7`，但上传的 tarball 仍然叫 `*-2.2.5.tar.gz`，
用户会默认该产物过时或版本错配。

规则：**release tag、registry index 版本、tarball 文件名必须一致**（除非你显式写进 release notes 并解释原因）。

## “协议级”发布最低清单

- 有稳定的 CEP spec 版本（例如 v2.2），并被 runtime/文档引用。
- registry tarballs 的可复现构建流程。
- index 格式包含完整性字段（sha256/size/created_at）。
- 第三方可运行的 conformance 测试（`npx cogn@2.2.11 test`）。

可选但价值很高的增强：

- 对 registry 资产进行签名，并让客户端支持验签。
- 一个公开 conformance 面板，把结果精确绑定到 commit/tag。
