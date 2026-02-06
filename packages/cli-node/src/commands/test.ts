/**
 * Test Command - Run golden tests for Cognitive Modules
 * 
 * Usage:
 *   cog test <module>           - Run tests for a specific module
 *   cog test --all              - Run tests for all modules
 *   cog test <module> --update  - Update expected outputs
 * 
 * Tests are defined in module.yaml:
 *   tests:
 *     - tests/case1.input.json -> tests/case1.expected.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandContext, CommandResult, CognitiveModule } from '../types.js';
import { findModule, listModules, getDefaultSearchPaths } from '../modules/loader.js';
import { runModule } from '../modules/runner.js';

// =============================================================================
// Types
// =============================================================================

export interface TestCase {
  name: string;
  inputPath: string;
  expectedPath: string;
  input?: unknown;
  expected?: unknown;
}

export interface TestResult {
  name: string;
  passed: boolean;
  duration_ms: number;
  error?: string;
  diff?: {
    field: string;
    expected: unknown;
    actual: unknown;
  }[];
}

export interface ModuleTestResult {
  moduleName: string;
  modulePath: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  results: TestResult[];
}

export interface TestOptions {
  verbose?: boolean;
  update?: boolean;
  filter?: string;
  timeout?: number;
}

// =============================================================================
// Test Case Parsing
// =============================================================================

/**
 * Parse test definitions from module.yaml tests field
 * 
 * Format: "tests/case1.input.json -> tests/case1.expected.json"
 */
export function parseTestDefinitions(
  module: CognitiveModule,
  modulePath: string
): TestCase[] {
  const tests: TestCase[] = [];
  const testsConfig = (module as unknown as { tests?: string[] }).tests;
  
  if (!testsConfig || !Array.isArray(testsConfig)) {
    return tests;
  }
  
  for (const testDef of testsConfig) {
    // Parse "input.json -> expected.json" format
    const match = testDef.match(/^\s*(.+?)\s*->\s*(.+?)\s*$/);
    if (!match) {
      continue;
    }
    
    const inputRelPath = match[1];
    const expectedRelPath = match[2];
    
    // Get the module directory
    const moduleDir = path.dirname(modulePath);
    
    const inputPath = path.resolve(moduleDir, inputRelPath);
    const expectedPath = path.resolve(moduleDir, expectedRelPath);
    
    // Extract test name from input file
    const testName = path.basename(inputRelPath, '.input.json');
    
    tests.push({
      name: testName,
      inputPath,
      expectedPath,
    });
  }
  
  return tests;
}

/**
 * Auto-discover test cases in tests/ directory
 */
export function discoverTestCases(modulePath: string): TestCase[] {
  const tests: TestCase[] = [];
  const moduleDir = path.dirname(modulePath);
  const testsDir = path.join(moduleDir, 'tests');
  
  if (!fs.existsSync(testsDir)) {
    return tests;
  }
  
  const files = fs.readdirSync(testsDir);
  const inputFiles = files.filter(f => f.endsWith('.input.json'));
  
  for (const inputFile of inputFiles) {
    const testName = inputFile.replace('.input.json', '');
    const expectedFile = `${testName}.expected.json`;
    
    if (files.includes(expectedFile)) {
      tests.push({
        name: testName,
        inputPath: path.join(testsDir, inputFile),
        expectedPath: path.join(testsDir, expectedFile),
      });
    }
  }
  
  return tests;
}

// =============================================================================
// Test Execution
// =============================================================================

/**
 * Check if expected file uses schema validation format ($validate)
 */
function isSchemaValidationFormat(expected: unknown): expected is { $validate: unknown; $example?: unknown } {
  return (
    typeof expected === 'object' &&
    expected !== null &&
    '$validate' in expected
  );
}

/**
 * Validate actual result against schema validation format
 * Returns array of validation errors
 */
function validateAgainstSchema(
  schema: Record<string, unknown>,
  actual: unknown,
  path: string = ''
): Array<{ field: string; expected: unknown; actual: unknown }> {
  const errors: Array<{ field: string; expected: unknown; actual: unknown }> = [];
  
  if (actual === null || actual === undefined) {
    errors.push({ field: path || 'root', expected: 'value', actual });
    return errors;
  }
  
  // Handle const constraint
  if ('const' in schema) {
    if (actual !== schema.const) {
      errors.push({ field: path || 'root', expected: `const: ${schema.const}`, actual });
    }
    return errors;
  }
  
  // Handle type constraint
  if ('type' in schema) {
    const schemaType = schema.type as string;
    const actualType = Array.isArray(actual) ? 'array' : typeof actual;
    
    if (schemaType === 'array' && !Array.isArray(actual)) {
      errors.push({ field: path || 'root', expected: 'array', actual: actualType });
      return errors;
    }
    
    if (schemaType === 'object' && (typeof actual !== 'object' || Array.isArray(actual))) {
      errors.push({ field: path || 'root', expected: 'object', actual: actualType });
      return errors;
    }
    
    if (schemaType === 'number' && typeof actual !== 'number') {
      errors.push({ field: path || 'root', expected: 'number', actual: actualType });
      return errors;
    }
    
    if (schemaType === 'string' && typeof actual !== 'string') {
      errors.push({ field: path || 'root', expected: 'string', actual: actualType });
      return errors;
    }
  }
  
  // Handle number constraints
  if (typeof actual === 'number') {
    if ('minimum' in schema && actual < (schema.minimum as number)) {
      errors.push({ field: path, expected: `>= ${schema.minimum}`, actual });
    }
    if ('maximum' in schema && actual > (schema.maximum as number)) {
      errors.push({ field: path, expected: `<= ${schema.maximum}`, actual });
    }
  }
  
  // Handle string constraints
  if (typeof actual === 'string') {
    if ('minLength' in schema && actual.length < (schema.minLength as number)) {
      errors.push({ field: path, expected: `minLength: ${schema.minLength}`, actual: `length: ${actual.length}` });
    }
    if ('maxLength' in schema && actual.length > (schema.maxLength as number)) {
      errors.push({ field: path, expected: `maxLength: ${schema.maxLength}`, actual: `length: ${actual.length}` });
    }
    if ('enum' in schema && !((schema.enum as string[]).includes(actual))) {
      errors.push({ field: path, expected: `enum: ${JSON.stringify(schema.enum)}`, actual });
    }
  }
  
  // Handle array constraints
  if (Array.isArray(actual)) {
    if ('minItems' in schema && actual.length < (schema.minItems as number)) {
      errors.push({ field: path, expected: `minItems: ${schema.minItems}`, actual: `length: ${actual.length}` });
    }
    if ('items' in schema) {
      const itemSchema = schema.items as Record<string, unknown>;
      for (let i = 0; i < actual.length; i++) {
        errors.push(...validateAgainstSchema(itemSchema, actual[i], `${path}[${i}]`));
      }
    }
  }
  
  // Handle object constraints
  if (typeof actual === 'object' && !Array.isArray(actual) && actual !== null) {
    const actualObj = actual as Record<string, unknown>;
    
    // Check required fields
    if ('required' in schema) {
      const required = schema.required as string[];
      for (const field of required) {
        if (!(field in actualObj)) {
          errors.push({ field: `${path}.${field}`, expected: 'required field', actual: 'missing' });
        }
      }
    }
    
    // Validate properties
    if ('properties' in schema) {
      const properties = schema.properties as Record<string, Record<string, unknown>>;
      for (const [key, propSchema] of Object.entries(properties)) {
        if (key in actualObj) {
          errors.push(...validateAgainstSchema(propSchema, actualObj[key], path ? `${path}.${key}` : key));
        }
      }
    }
  }
  
  return errors;
}

/**
 * Compare two values and return differences
 */
function deepCompare(
  expected: unknown,
  actual: unknown,
  path: string = ''
): Array<{ field: string; expected: unknown; actual: unknown }> {
  const diffs: Array<{ field: string; expected: unknown; actual: unknown }> = [];
  
  // Handle null/undefined
  if (expected === null || expected === undefined) {
    if (actual !== expected) {
      diffs.push({ field: path || 'root', expected, actual });
    }
    return diffs;
  }
  
  // Type mismatch
  if (typeof expected !== typeof actual) {
    diffs.push({ field: path || 'root', expected, actual });
    return diffs;
  }
  
  // Arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      diffs.push({ field: path || 'root', expected, actual });
      return diffs;
    }
    
    if (expected.length !== actual.length) {
      diffs.push({ field: `${path}.length`, expected: expected.length, actual: actual.length });
    }
    
    const maxLen = Math.max(expected.length, actual.length);
    for (let i = 0; i < maxLen; i++) {
      diffs.push(...deepCompare(expected[i], actual[i], `${path}[${i}]`));
    }
    return diffs;
  }
  
  // Objects
  if (typeof expected === 'object') {
    if (typeof actual !== 'object' || actual === null) {
      diffs.push({ field: path || 'root', expected, actual });
      return diffs;
    }
    
    const expectedObj = expected as Record<string, unknown>;
    const actualObj = actual as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(expectedObj), ...Object.keys(actualObj)]);
    
    for (const key of allKeys) {
      // Skip dynamic fields that change between runs
      if (['trace_id', 'latency_ms', 'model', 'timestamp', 'version'].includes(key)) {
        continue;
      }
      
      const fieldPath = path ? `${path}.${key}` : key;
      
      if (!(key in expectedObj)) {
        // Extra field in actual - only report if it's significant
        continue;
      }
      
      if (!(key in actualObj)) {
        diffs.push({ field: fieldPath, expected: expectedObj[key], actual: undefined });
        continue;
      }
      
      diffs.push(...deepCompare(expectedObj[key], actualObj[key], fieldPath));
    }
    return diffs;
  }
  
  // Primitives
  if (expected !== actual) {
    // For confidence, allow small variations
    if (path.endsWith('.confidence') && typeof expected === 'number' && typeof actual === 'number') {
      if (Math.abs(expected - actual) <= 0.1) {
        return diffs; // Close enough
      }
    }
    diffs.push({ field: path || 'root', expected, actual });
  }
  
  return diffs;
}

/**
 * Run a single test case
 */
async function runTestCase(
  testCase: TestCase,
  module: CognitiveModule,
  ctx: CommandContext,
  options: TestOptions = {}
): Promise<TestResult> {
  const startTime = Date.now();
  const { timeout = 60000 } = options;
  
  try {
    // Load input
    if (!fs.existsSync(testCase.inputPath)) {
      return {
        name: testCase.name,
        passed: false,
        duration_ms: Date.now() - startTime,
        error: `Input file not found: ${testCase.inputPath}`,
      };
    }
    
    const inputContent = fs.readFileSync(testCase.inputPath, 'utf-8');
    const input = JSON.parse(inputContent);
    
    // Load expected (if exists)
    let expected: unknown = null;
    if (fs.existsSync(testCase.expectedPath)) {
      const expectedContent = fs.readFileSync(testCase.expectedPath, 'utf-8');
      expected = JSON.parse(expectedContent);
    }
    
    // Run module with timeout
    const runPromise = runModule(module, ctx.provider, {
      input,
      validateInput: true,
      validateOutput: true,
      useV22: true,
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout);
    });
    
    const result = await Promise.race([runPromise, timeoutPromise]);
    
    // Update mode - write actual output as expected
    if (options.update) {
      fs.writeFileSync(testCase.expectedPath, JSON.stringify(result, null, 2));
      return {
        name: testCase.name,
        passed: true,
        duration_ms: Date.now() - startTime,
      };
    }
    
    // No expected file - skip comparison
    if (expected === null) {
      return {
        name: testCase.name,
        passed: false,
        duration_ms: Date.now() - startTime,
        error: `Expected file not found: ${testCase.expectedPath}`,
      };
    }
    
    // Compare results - use schema validation or direct comparison
    let diffs: Array<{ field: string; expected: unknown; actual: unknown }>;
    
    if (isSchemaValidationFormat(expected)) {
      // Schema validation mode
      diffs = validateAgainstSchema(expected.$validate as Record<string, unknown>, result);
    } else {
      // Direct comparison mode
      diffs = deepCompare(expected, result);
    }
    
    if (diffs.length === 0) {
      return {
        name: testCase.name,
        passed: true,
        duration_ms: Date.now() - startTime,
      };
    } else {
      return {
        name: testCase.name,
        passed: false,
        duration_ms: Date.now() - startTime,
        diff: diffs.slice(0, 10), // Limit to first 10 diffs
        error: `${diffs.length} difference(s) found`,
      };
    }
    
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Commands
// =============================================================================

/**
 * Run tests for a single module
 */
export async function test(
  moduleName: string,
  ctx: CommandContext,
  options: TestOptions = {}
): Promise<CommandResult> {
  const startTime = Date.now();
  const searchPaths = getDefaultSearchPaths(ctx.cwd);
  
  // Find module
  const module = await findModule(moduleName, searchPaths);
  if (!module) {
    return {
      success: false,
      error: `Module '${moduleName}' not found`,
    };
  }
  
  // Get test cases from module.yaml or auto-discover
  let testCases = parseTestDefinitions(module, module.location);
  
  if (testCases.length === 0) {
    testCases = discoverTestCases(module.location);
  }
  
  if (testCases.length === 0) {
    return {
      success: true,
      data: {
        moduleName: module.name,
        modulePath: module.location,
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration_ms: Date.now() - startTime,
        results: [],
      },
    };
  }
  
  // Filter tests if specified
  if (options.filter) {
    testCases = testCases.filter(tc => tc.name.includes(options.filter!));
  }
  
  // Run tests
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    if (options.verbose) {
      console.error(`  Running: ${testCase.name}...`);
    }
    
    const result = await runTestCase(testCase, module, ctx, options);
    results.push(result);
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }
  
  const testResult: ModuleTestResult = {
    moduleName: module.name,
    modulePath: module.location,
    total: testCases.length,
    passed,
    failed,
    skipped: 0,
    duration_ms: Date.now() - startTime,
    results,
  };
  
  return {
    success: failed === 0,
    data: testResult,
  };
}

/**
 * Run tests for all modules
 */
export async function testAll(
  ctx: CommandContext,
  options: TestOptions = {}
): Promise<CommandResult> {
  const startTime = Date.now();
  const searchPaths = getDefaultSearchPaths(ctx.cwd);
  
  // List all modules
  const modules = await listModules(searchPaths);
  
  const results: ModuleTestResult[] = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let modulesWithTests = 0;
  
  for (const moduleInfo of modules) {
    const result = await test(moduleInfo.name, ctx, options);
    
    if (result.success && result.data) {
      const moduleResult = result.data as ModuleTestResult;
      results.push(moduleResult);
      
      if (moduleResult.total > 0) {
        modulesWithTests++;
        totalTests += moduleResult.total;
        totalPassed += moduleResult.passed;
        totalFailed += moduleResult.failed;
      }
    }
  }
  
  return {
    success: totalFailed === 0,
    data: {
      total: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      skipped: modules.length - modulesWithTests,
      duration_ms: Date.now() - startTime,
      modules: results,
    },
  };
}
