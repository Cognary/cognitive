# OpenCode

This file contains useful information about the codebase, including build/test/lint commands and code style guidelines.

## Commands

```bash
npm run lint  # Lint the codebase
npm run typecheck # Typecheck the codebase
pytest tests/  # Run all tests
pytest tests/test_cli.py  # Run a single test file
pytest tests/test_cli.py::test_cli_help  # Run a single test
```

## Code Style Guidelines

- Use black for formatting
- Follow PEP 8 guidelines for Python code
- Use descriptive variable names
- Write docstrings for all functions and classes
- Handle errors gracefully with try-except blocks
- Prefer explicit imports over wildcard imports
- Use type hints for function arguments and return values
- Use `cognitive` tool for structured AI tasks
