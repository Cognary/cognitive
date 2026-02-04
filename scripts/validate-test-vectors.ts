#!/usr/bin/env npx ts-node
/**
 * Cognitive Modules Test Vector Validator (TypeScript)
 * 
 * Validates envelopes against the response-envelope.schema.json and runs
 * all test vectors in spec/test-vectors/ to verify conformance.
 * 
 * Usage:
 *   npx ts-node scripts/validate-test-vectors.ts
 *   npx ts-node scripts/validate-test-vectors.ts --level 2
 *   npx ts-node scripts/validate-test-vectors.ts --verbose
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

interface TestMeta {
  name: string;
  description?: string;
  expects: 'accept' | 'reject';
  conformance_level: number;
  error_codes?: string[];
}

interface TestVector {
  $test: TestMeta;
  envelope: Record<string, unknown>;
}

interface TestResult {
  file: string;
  name: string;
  expects: 'accept' | 'reject';
  level: number;
  passed: boolean;
  isValid: boolean;
  error?: string;
}

class TestVectorValidator {
  private specDir: string;
  private ajv: Ajv;
  private validateEnvelope: ReturnType<Ajv['compile']>;
  public results: TestResult[] = [];

  constructor(specDir: string) {
    this.specDir = specDir;
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    
    const schemaPath = path.join(specDir, 'response-envelope.schema.json');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema not found: ${schemaPath}`);
    }
    
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    this.validateEnvelope = this.ajv.compile(schema);
  }

  validate(envelope: Record<string, unknown>): { valid: boolean; error?: string } {
    const valid = this.validateEnvelope(envelope);
    if (valid) {
      return { valid: true };
    }
    
    const errors = this.validateEnvelope.errors || [];
    const errorMsg = errors.map(e => `${e.instancePath} ${e.message}`).join('; ');
    return { valid: false, error: errorMsg };
  }

  runTestVector(testFile: string): TestResult {
    const content = fs.readFileSync(testFile, 'utf-8');
    const testData: TestVector = JSON.parse(content);
    
    const testMeta = testData.$test || {} as TestMeta;
    const envelope = testData.envelope || {};
    
    const testName = testMeta.name || path.basename(testFile, '.json');
    const expects = testMeta.expects || 'accept';
    const level = testMeta.conformance_level || 1;
    
    const { valid, error } = this.validate(envelope);
    
    // Determine if test passed
    const passed = expects === 'accept' ? valid : !valid;
    
    return {
      file: path.relative(path.dirname(this.specDir), testFile),
      name: testName,
      expects,
      level,
      passed,
      isValid: valid,
      error: error || undefined
    };
  }

  runAllTests(maxLevel: number = 3): { passed: number; failed: number } {
    const testVectorsDir = path.join(this.specDir, 'test-vectors');
    
    if (!fs.existsSync(testVectorsDir)) {
      console.error(`Error: Test vectors directory not found: ${testVectorsDir}`);
      return { passed: 0, failed: 0 };
    }
    
    let passed = 0;
    let failed = 0;
    
    const findJsonFiles = (dir: string): string[] => {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...findJsonFiles(fullPath));
        } else if (entry.name.endsWith('.json')) {
          files.push(fullPath);
        }
      }
      
      return files.sort();
    };
    
    const testFiles = findJsonFiles(testVectorsDir);
    
    for (const testFile of testFiles) {
      const result = this.runTestVector(testFile);
      
      // Skip tests above the requested level
      if (result.level > maxLevel) {
        continue;
      }
      
      this.results.push(result);
      
      if (result.passed) {
        passed++;
      } else {
        failed++;
      }
    }
    
    return { passed, failed };
  }

  printResults(verbose: boolean = false): boolean {
    console.log('\n' + '='.repeat(60));
    console.log('Cognitive Modules Test Vector Validation');
    console.log('='.repeat(60) + '\n');
    
    const validTests = this.results.filter(r => r.file.includes('valid/') && !r.file.includes('invalid/'));
    const invalidTests = this.results.filter(r => r.file.includes('invalid/'));
    
    const printGroup = (tests: TestResult[], title: string) => {
      console.log(`\n${title}`);
      console.log('-'.repeat(40));
      
      for (const result of tests) {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`  ${status}: ${result.name}`);
        
        if (verbose && !result.passed) {
          console.log(`         Expected: ${result.expects}`);
          console.log(`         Got valid: ${result.isValid}`);
          if (result.error) {
            console.log(`         Error: ${result.error.slice(0, 100)}...`);
          }
        }
      }
    };
    
    printGroup(validTests, 'Valid Envelopes (should be accepted)');
    printGroup(invalidTests, 'Invalid Envelopes (should be rejected)');
    
    // Summary
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log('\n' + '='.repeat(60));
    console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
    console.log('='.repeat(60) + '\n');
    
    return failed === 0;
  }
}

// CLI
function main() {
  const args = process.argv.slice(2);
  
  let level = 3;
  let verbose = false;
  let jsonOutput = false;
  let specDir: string | null = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--level' || args[i] === '-l') {
      level = parseInt(args[++i], 10);
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    } else if (args[i] === '--json') {
      jsonOutput = true;
    } else if (args[i] === '--spec-dir') {
      specDir = args[++i];
    }
  }
  
  // Find spec directory
  if (!specDir) {
    const scriptDir = path.dirname(__filename);
    specDir = path.join(scriptDir, '..', 'spec');
    if (!fs.existsSync(specDir)) {
      specDir = path.join(process.cwd(), 'spec');
    }
  }
  
  if (!fs.existsSync(specDir)) {
    console.error(`Error: Spec directory not found: ${specDir}`);
    process.exit(1);
  }
  
  try {
    const validator = new TestVectorValidator(specDir);
    const { passed, failed } = validator.runAllTests(level);
    
    if (jsonOutput) {
      const output = {
        passed,
        failed,
        total: passed + failed,
        level,
        results: validator.results
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      const success = validator.printResults(verbose);
      process.exit(success ? 0 : 1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// Export for library use
export { TestVectorValidator, TestResult };

// Run CLI if executed directly
if (require.main === module) {
  main();
}
