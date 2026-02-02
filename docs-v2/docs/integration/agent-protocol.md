---
sidebar_position: 4
---

# Agent Protocol

Cognitive Modules compatibility with the Agent Protocol standard.

## What is Agent Protocol?

Agent Protocol is an open standard for agent-to-agent communication, enabling interoperability between different AI agent systems.

## Compatibility

Cognitive Modules implements a subset of the Agent Protocol specification:

| Feature | Status |
|---------|--------|
| Task Creation | ✅ |
| Task Execution | ✅ |
| Task Status | ✅ |
| Artifacts | ✅ |
| Streaming | 🚧 |

## Starting Agent Protocol Server

```bash
cog agent-protocol --port 8080
```

## Endpoints

### Create Task

```
POST /ap/v1/agent/tasks
```

Request:
```json
{
  "input": "Review this code for security issues",
  "additional_input": {
    "module": "code-reviewer",
    "code": "def login(): ..."
  }
}
```

Response:
```json
{
  "task_id": "task-123",
  "input": "Review this code...",
  "status": "created"
}
```

### Execute Task Step

```
POST /ap/v1/agent/tasks/:task_id/steps
```

Response:
```json
{
  "step_id": "step-1",
  "task_id": "task-123",
  "status": "completed",
  "output": {
    "ok": true,
    "meta": {...},
    "data": {...}
  }
}
```

### Get Task

```
GET /ap/v1/agent/tasks/:task_id
```

### List Artifacts

```
GET /ap/v1/agent/tasks/:task_id/artifacts
```

## Mapping to Cognitive Modules

| Agent Protocol | Cognitive Modules |
|----------------|-------------------|
| Task | Module execution request |
| Step | Single module run |
| Artifact | Module output |
| Agent | Module |

## Example Workflow

```python
import requests

# 1. Create task
task = requests.post(
    'http://localhost:8080/ap/v1/agent/tasks',
    json={
        'input': 'Review code',
        'additional_input': {
            'module': 'code-reviewer',
            'code': '...'
        }
    }
).json()

task_id = task['task_id']

# 2. Execute step
step = requests.post(
    f'http://localhost:8080/ap/v1/agent/tasks/{task_id}/steps'
).json()

# 3. Get result
print(step['output']['data']['issues'])
```

## Multi-Agent Orchestration

Cognitive Modules can participate in multi-agent systems:

```yaml
# agent-workflow.yaml
agents:
  - name: code-reviewer
    protocol: cognitive
    endpoint: http://cognitive:8000
  
  - name: other-agent
    protocol: agent-protocol
    endpoint: http://other:8080

workflow:
  - agent: code-reviewer
    input: $user_code
  - agent: other-agent
    input: $previous.output
```
