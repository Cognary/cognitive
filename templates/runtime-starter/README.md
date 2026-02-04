# Cognitive Modules Runtime Starter

A minimal template for building your own Cognitive Modules runtime implementation.

## Quick Start

```bash
# Clone this template
cp -r templates/runtime-starter my-cognitive-runtime
cd my-cognitive-runtime

# Install dependencies
pip install -r requirements.txt  # Python
# or
npm install                       # TypeScript

# Run test vectors to verify your implementation
python validate.py
# or
npx ts-node validate.ts
```

## What's Included

```
runtime-starter/
├── README.md                 # This file
├── requirements.txt          # Python dependencies
├── package.json              # Node.js dependencies
├── runtime.py                # Python runtime skeleton
├── runtime.ts                # TypeScript runtime skeleton
├── validate.py               # Test vector runner (Python)
└── validate.ts               # Test vector runner (TypeScript)
```

## Implementation Checklist

Use this checklist to track your progress toward conformance:

### Level 1: Basic Conformance

```
□ Module Loader
  □ Parse module.yaml (YAML)
  □ Read prompt.md
  □ Parse schema.json

□ Input Validation
  □ Validate input against schema.json#/input
  □ Return E1001 for invalid input

□ Prompt Builder
  □ $ARGUMENTS substitution
  □ Append envelope format instruction

□ LLM Execution
  □ At least one provider (OpenAI/Anthropic/etc)
  □ JSON mode support recommended

□ Response Parsing
  □ Direct JSON parse
  □ Markdown code block extraction
  □ Return E1000 for parse failures

□ Envelope Validation
  □ Validate against response-envelope.schema.json
  □ Validate meta.confidence [0, 1]
  □ Validate meta.risk enum
  □ Validate meta.explain maxLength 280

□ Test Vectors
  □ Pass all spec/test-vectors/valid/*.json
  □ Reject all spec/test-vectors/invalid/*.json
```

### Level 2: Standard Conformance

```
□ Tier Support
  □ Support exec/decision/exploration tiers
  □ Enforce tier-specific defaults

□ Error Codes
  □ Implement E1xxx (input errors)
  □ Implement E2xxx (processing errors)
  □ Implement E3xxx (output errors)

□ Repair Pass
  □ Fill missing meta fields
  □ Truncate over-length explain
  □ Never change business semantics

□ Extensible Enum
  □ Support {custom, reason} objects
  □ Enforce strict mode when configured
```

### Level 3: Full Conformance

```
□ Module Composition
  □ Parse @call:module directives
  □ Recursive execution
  □ Circular dependency detection

□ Context Protocol
  □ Support fork/main modes
  □ Context injection

□ Policy Enforcement
  □ Check policies from module.yaml
  □ Block denied tools
```

## Testing Your Implementation

1. Copy the official test vectors:
   ```bash
   cp -r ../spec/test-vectors ./test-vectors
   ```

2. Run the validation script:
   ```bash
   python validate.py --verbose
   ```

3. Check the results:
   - All `valid/*.json` tests should pass (accept)
   - All `invalid/*.json` tests should pass (reject)

## Claiming Conformance

Once your implementation passes all test vectors for a level:

1. Add a conformance declaration to your README:
   ```markdown
   ## Conformance
   
   This implementation conforms to Cognitive Modules Specification v2.2 at **Level 2**.
   ```

2. (Optional) Submit for official verification when the certification program launches.

## Resources

- [SPEC-v2.2.md](../../SPEC-v2.2.md) - Full specification
- [IMPLEMENTERS-GUIDE.md](../../IMPLEMENTERS-GUIDE.md) - Detailed implementation guide
- [CONFORMANCE.md](../../CONFORMANCE.md) - Conformance level requirements
- [ERROR-CODES.md](../../ERROR-CODES.md) - Error code taxonomy
- [spec/](../../spec/) - JSON Schemas and test vectors

## License

MIT - Use this template freely for your implementation.
