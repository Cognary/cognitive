---
sidebar_position: 4
---

# 可迁移/可发布产物清单（Registry Tarballs）

这页是实践版清单，用于把模块做到“可迁移、可发布、可校验”。
目标是确定性安装与可证明来源，而不是尽力而为的 Git 拉取。

## 产物

一个可发布的 registry 通常包含：

- Registry index：`cognitive-registry.v2.json`
- Release assets：每个模块一个 tarball，命名 `<module>-<version>.tar.gz`
- 每个模块的完整性元数据：
  - `checksum`（推荐 `sha256:<hex>`）
  - `size_bytes`

tarball 是分发单元。
index 是发现单元。

## 构建

生成 tarball 并重建 v2 index：

```bash
npx cogn@2.2.11 registry build --tag vX.Y.Z
```

常见输出：

- `dist/registry-assets/`：tarball 与构建产物
- `cognitive-registry.v2.json`：更新后的索引（包含 `distribution` 字段）

## 校验（本地）

校验本地 tarball 是否与 index 一致：

```bash
npx cogn@2.2.11 registry verify --index cognitive-registry.v2.json --assets-dir dist/registry-assets
```

会检查：

- sha256 checksum
- 大小上限与实际大小
- 安全解压与文件预期

## 校验（远端）

拉取远端 index 与 tarball 并校验完整性：

```bash
npx cogn@2.2.11 registry verify --remote --index https://github.com/<org>/<repo>/releases/latest/download/cognitive-registry.v2.json
```

为了可复现，建议固定 tag：

```bash
npx cogn@2.2.11 registry verify --remote --index https://github.com/<org>/<repo>/releases/download/vX.Y.Z/cognitive-registry.v2.json
```

远端校验带门禁：

- 超时
- index 最大字节数
- tarball 最大字节数
- 安全解压规则

调参示例：

```bash
npx cogn@2.2.11 registry verify --remote \
  --fetch-timeout-ms 20000 \
  --max-index-bytes 2097152 \
  --max-tarball-bytes 26214400 \
  --concurrency 2
```

## “Latest” 策略

默认 registry URL 优先用 GitHub Releases 的 `latest` 资产：

- 优点：index 与 tarball 与一个发布版本绑定
- 缺点：可能存在短暂窗口，`latest` 已指向新版本但资产仍在上传中

Cognitive 会在 `latest` 暂时不可用时允许安全回退到仓库内的 index，以保持 `search/add` 可用。
如果你需要严格可复现，CI 和生产环境建议固定 release tag。
