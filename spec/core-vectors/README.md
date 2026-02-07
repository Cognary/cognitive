# Core Conformance Vectors

These vectors define the **stable, publish-grade behavior** of the `cog core` "5-minute path".

Scope:

- `cog core new`: one-file module template (frontmatter + prompt body)
- `cog core schema`: generated loose schemas (meta/input/data/error)
- `cog core promote`: deterministic v2.2 module directory output

Non-goals:

- Provider outputs. LLM responses are out of scope for conformance vectors and are tested separately.

How it is enforced:

- `packages/cli-node/src/commands/core.vectors.test.ts` regenerates outputs and compares them to the files here.
- Any change must be intentional and update these vectors.

