# Conformance Testing Guide

This guide is for developers implementing a Cognitive Modules runtime who want to verify conformance with the specification.

## Quick Start

### 1. Clone the Test Vectors

```bash
git clone https://github.com/Cognary/cognitive.git
cd cognitive-modules/spec/test-vectors
```

### 2. Run Official Validators

**TypeScript/Node.js:**
```bash
npm install ajv tsx
npx tsx scripts/validate-test-vectors.ts --level 3 --verbose
```

**CEP streaming vectors (events + terminal envelope):**
```bash
npm install ajv ajv-formats tsx
npx tsx scripts/validate-stream-vectors.ts --level 3 --verbose
```

**CEP registry vectors (index + entries):**
```bash
npm install ajv ajv-formats tsx
npx tsx scripts/validate-registry-vectors.ts --level 3 --verbose
```

**Registry safety (tarball extraction):**
```bash
cd packages/cli-node
npm test
```

The Node CLI test suite includes tarball extraction safety checks:

- `packages/cli-node/src/registry/tar.test.ts`

### 3. Integrate Into Your Test Suite

See examples below for your language.

---

## Test Vector Structure

Each test vector file contains:

```json
{
  "$test": {
    "name": "test-name",
    "description": "What this test validates",
    "expects": "accept" | "reject",
    "conformance_level": 1 | 2 | 3,
    "error_codes": ["E1001"]  // For reject cases
  },
  "envelope": {
    // The response envelope to validate
  }
}
```

## Conformance Levels

| Level | Name | Requirements |
|-------|------|--------------|
| 1 | Basic | Core envelope validation (ok, meta, data/error) |
| 2 | Standard | + Tier support, overflow handling, error codes |
| 3 | Full | + Composition, context protocol, all features |

## Running Tests in Your Implementation

### Python Example

```python
import json
from pathlib import Path
from your_runtime import validate_envelope, ValidationError

def run_conformance_tests(test_dir: Path, level: int = 1):
    results = {"passed": 0, "failed": 0, "skipped": 0}
    
    for file in test_dir.glob("**/*.json"):
        with open(file) as f:
            test = json.load(f)
        
        meta = test["$test"]
        
        # Skip tests above our conformance level
        if meta["conformance_level"] > level:
            results["skipped"] += 1
            continue
        
        envelope = test["envelope"]
        expected = meta["expects"]
        
        try:
            validate_envelope(envelope)
            actual = "accept"
        except ValidationError:
            actual = "reject"
        
        if actual == expected:
            results["passed"] += 1
            print(f"✅ PASS: {meta['name']}")
        else:
            results["failed"] += 1
            print(f"❌ FAIL: {meta['name']} (expected {expected}, got {actual})")
    
    return results

# Run all level 1 tests
run_conformance_tests(Path("spec/test-vectors"), level=1)
```

### TypeScript/Node.js Example

```typescript
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { validateEnvelope, ValidationError } from 'your-runtime';

interface TestMeta {
  name: string;
  description: string;
  expects: 'accept' | 'reject';
  conformance_level: number;
  error_codes?: string[];
}

interface TestVector {
  $test: TestMeta;
  envelope: unknown;
}

function runConformanceTests(testDir: string, level: number = 1) {
  const results = { passed: 0, failed: 0, skipped: 0 };
  
  function processDir(dir: string) {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        processDir(path);
      } else if (entry.endsWith('.json')) {
        const test: TestVector = JSON.parse(readFileSync(path, 'utf-8'));
        const meta = test.$test;
        
        if (meta.conformance_level > level) {
          results.skipped++;
          continue;
        }
        
        let actual: 'accept' | 'reject';
        try {
          validateEnvelope(test.envelope);
          actual = 'accept';
        } catch (e) {
          actual = 'reject';
        }
        
        if (actual === meta.expects) {
          results.passed++;
          console.log(`✅ PASS: ${meta.name}`);
        } else {
          results.failed++;
          console.log(`❌ FAIL: ${meta.name} (expected ${meta.expects}, got ${actual})`);
        }
      }
    }
  }
  
  processDir(testDir);
  return results;
}

// Run all level 2 tests
runConformanceTests('spec/test-vectors', 2);
```

### Go Example

```go
package conformance

import (
    "encoding/json"
    "io/fs"
    "os"
    "path/filepath"
    "testing"
)

type TestMeta struct {
    Name             string   `json:"name"`
    Description      string   `json:"description"`
    Expects          string   `json:"expects"`
    ConformanceLevel int      `json:"conformance_level"`
    ErrorCodes       []string `json:"error_codes,omitempty"`
}

type TestVector struct {
    Test     TestMeta    `json:"$test"`
    Envelope interface{} `json:"envelope"`
}

func TestConformance(t *testing.T) {
    level := 1 // Adjust based on your implementation
    
    err := filepath.WalkDir("spec/test-vectors", func(path string, d fs.DirEntry, err error) error {
        if err != nil || d.IsDir() || filepath.Ext(path) != ".json" {
            return err
        }
        
        data, err := os.ReadFile(path)
        if err != nil {
            return err
        }
        
        var test TestVector
        if err := json.Unmarshal(data, &test); err != nil {
            return err
        }
        
        if test.Test.ConformanceLevel > level {
            t.Logf("SKIP: %s (level %d > %d)", test.Test.Name, test.Test.ConformanceLevel, level)
            return nil
        }
        
        t.Run(test.Test.Name, func(t *testing.T) {
            err := ValidateEnvelope(test.Envelope)
            actual := "accept"
            if err != nil {
                actual = "reject"
            }
            
            if actual != test.Test.Expects {
                t.Errorf("expected %s, got %s", test.Test.Expects, actual)
            }
        })
        
        return nil
    })
    
    if err != nil {
        t.Fatal(err)
    }
}
```

---

## CI Integration

### GitHub Actions Example

```yaml
name: Conformance Tests

on: [push, pull_request]

jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Clone Cognitive Modules test vectors
        run: |
          git clone --depth 1 https://github.com/Cognary/cognitive.git /tmp/cognitive
          cp -r /tmp/cognitive/spec/test-vectors ./test-vectors
      
      - name: Run conformance tests
        run: |
          # Your test command here
          npm test -- --grep "conformance"
```

---

## Claiming Conformance

To claim conformance with the Cognitive Modules specification:

1. **Pass all test vectors** at your claimed level
2. **Document your level** in your README:
   ```markdown
   ## Conformance
   
   This implementation passes Cognitive Modules v2.2 conformance tests at **Level 2 (Standard)**.
   ```
3. **Run tests in CI** to maintain conformance

### Conformance Badge (Coming Soon)

We plan to provide conformance badges for verified implementations. Stay tuned.

---

## Submitting Your Implementation

If you've built a conformant implementation, we'd love to list it!

1. Open an issue with:
   - Implementation name and URL
   - Language/platform
   - Conformance level achieved
   - CI badge or test results link

2. We'll review and add it to the official implementations list.

---

## Questions?

- Open an issue on [GitHub](https://github.com/Cognary/cognitive/issues)
- Read the [CONFORMANCE.md](./CONFORMANCE.md) for detailed requirements
- Check [SPEC-v2.2.md](./SPEC-v2.2.md) for the full specification
