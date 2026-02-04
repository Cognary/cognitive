---
sidebar_position: 1
---

# Specification Overview

The Cognitive Modules specification defines a standard for verifiable, structured AI task execution.

## Current Version: v2.5

**v2.5** adds streaming response and multimodal support while maintaining full backward compatibility with v2.2.

| Feature | Description |
|---------|-------------|
| 🔄 **Streaming** | Real-time chunk-based output |
| 🖼️ **Multimodal** | Native image/audio/video support |
| ✅ **Compatible** | v2.2 modules work unchanged |

## Documents

### Core Specification

| Document | Description |
|----------|-------------|
| [v2.5 Specification](./spec-v25) | **Latest** - Streaming & multimodal support |
| [v2.2 Specification](./spec-v22) | Envelope format, tiers, overflow |
| [Conformance Levels](./conformance) | Level 1/2/3/4 implementation requirements |
| [Error Codes](./error-codes) | Standard error taxonomy (E1xxx-E4xxx) |

### Advanced Features

| Document | Description |
|----------|-------------|
| [Module Composition](./composition) | Inter-module orchestration and dataflow |
| [Context Protocol](./context-protocol) | Stateful workflows with explicit context |

### Ecosystem

| Document | Description |
|----------|-------------|
| [Registry Protocol](./registry-protocol) | Module publishing and discovery |
| [Certification Program](./certification) | Quality badges and verification |

### For Implementers

| Document | Description |
|----------|-------------|
| [Implementer's Guide](./implementers-guide) | Step-by-step runtime building guide |

### Governance

| Document | Description |
|----------|-------------|
| [CMEP Process](./cmep-process) | Enhancement proposal process |
| [Governance](./governance) | Project governance structure |

## Quick Links

- [JSON Schemas](https://github.com/ziel-io/cognitive-modules/tree/main/spec) - Machine-readable schemas
- [Test Vectors](https://github.com/ziel-io/cognitive-modules/tree/main/spec/test-vectors) - Official compliance tests
- [Runtime Starter](https://github.com/ziel-io/cognitive-modules/tree/main/templates/runtime-starter) - Implementation template
