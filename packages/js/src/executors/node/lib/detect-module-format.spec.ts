import { detectModuleFormat } from './detect-module-format';
import { readTsConfig } from '../../../utils/typescript/ts-config';
import * as ts from 'typescript';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'path';

jest.mock('../../../utils/typescript/ts-config');

const mockReadTsConfig = readTsConfig as jest.MockedFunction<
  typeof readTsConfig
>;

describe('detectModuleFormat', () => {
  let tempFs: TempFs;
  let workspaceRoot: string;

  beforeEach(async () => {
    jest.resetAllMocks();
    tempFs = new TempFs('detect-module-format');
    workspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  describe('build executor format option detection', () => {
    it('should detect ESM from build options with ESM format', () => {
      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
        buildOptions: { format: ['esm'] },
      });

      expect(result).toBe('esm');
    });

    it('should detect CJS from build options with CJS format', () => {
      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
        buildOptions: { format: ['cjs'] },
      });

      expect(result).toBe('cjs');
    });

    it('should prefer ESM when build options contain both formats', () => {
      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
        buildOptions: { format: ['cjs', 'esm'] },
      });

      expect(result).toBe('esm');
    });

    it('should handle single format string (not array)', () => {
      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
        buildOptions: { format: 'esm' },
      });

      expect(result).toBe('esm');
    });
  });

  describe('file extension detection', () => {
    it('should detect ESM from .mjs extension', () => {
      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.mjs',
      });

      expect(result).toBe('esm');
    });

    it('should detect CJS from .cjs extension', () => {
      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.cjs',
      });

      expect(result).toBe('cjs');
    });

    it('should not override build options with file extension', () => {
      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.cjs', // CJS extension
        buildOptions: { format: ['esm'] }, // But build options say ESM
      });

      expect(result).toBe('esm'); // Build options should win
    });
  });

  describe('package.json type field detection', () => {
    it('should detect ESM from package.json type: "module"', () => {
      tempFs.createFilesSync({
        'apps/test/package.json': JSON.stringify({ type: 'module' }),
      });

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
      });

      expect(result).toBe('esm');
    });

    it('should detect CJS from package.json type: "commonjs"', () => {
      tempFs.createFilesSync({
        'apps/test/package.json': JSON.stringify({ type: 'commonjs' }),
      });

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
      });

      expect(result).toBe('cjs');
    });

    it('should handle missing package.json gracefully', () => {
      // Don't create any files - package.json doesn't exist

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
      });

      expect(result).toBe('cjs'); // Should fallback to CJS
    });

    it('should handle package.json read errors gracefully', () => {
      tempFs.createFilesSync({
        'apps/test/package.json': 'invalid json {', // Invalid JSON to trigger parse error
      });

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
      });

      expect(result).toBe('cjs'); // Should fallback to CJS
    });
  });

  describe('TypeScript configuration detection', () => {
    it('should detect ESM from TypeScript ES2022 module', () => {
      tempFs.createFilesSync({
        'apps/test/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.ES2022 },
      } as any);

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
        tsConfig: join(workspaceRoot, 'apps/test/tsconfig.json'),
      });

      expect(result).toBe('esm');
    });

    it('should detect ESM from TypeScript ESNext module', () => {
      tempFs.createFilesSync({
        'apps/test/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.ESNext },
      } as any);

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
        tsConfig: join(workspaceRoot, 'apps/test/tsconfig.json'),
      });

      expect(result).toBe('esm');
    });

    it('should default to CJS for NodeNext module', () => {
      tempFs.createFilesSync({
        'apps/test/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.NodeNext },
      } as any);

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
        tsConfig: join(workspaceRoot, 'apps/test/tsconfig.json'),
      });

      expect(result).toBe('cjs'); // NodeNext defaults to CJS when no package.json type
    });

    it('should handle missing TypeScript config gracefully', () => {
      // Don't create tsconfig.json file

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
        tsConfig: join(workspaceRoot, 'apps/test/tsconfig.json'),
      });

      expect(result).toBe('cjs'); // Should fallback to CJS
    });
  });

  describe('default behavior', () => {
    it('should default to CJS when no detection method succeeds', () => {
      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.js',
      });

      expect(result).toBe('cjs');
    });
  });

  describe('detection priority', () => {
    it('should prioritize build options over all other methods', () => {
      tempFs.createFilesSync({
        'apps/test/package.json': JSON.stringify({ type: 'module' }), // package.json says ESM
        'apps/test/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.ES2022 },
      } as any); // TypeScript says ESM

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.mjs', // File extension says ESM
        tsConfig: join(workspaceRoot, 'apps/test/tsconfig.json'),
        buildOptions: { format: ['cjs'] }, // But build options say CJS
      });

      expect(result).toBe('cjs'); // Build options should win
    });

    it('should prioritize file extension over package.json and TypeScript', () => {
      tempFs.createFilesSync({
        'apps/test/package.json': JSON.stringify({ type: 'commonjs' }), // package.json says CJS
        'apps/test/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.CommonJS },
      } as any); // TypeScript says CJS

      const result = detectModuleFormat({
        projectRoot: 'apps/test',
        workspaceRoot,
        main: 'main.mjs', // But file extension says ESM
        tsConfig: join(workspaceRoot, 'apps/test/tsconfig.json'),
      });

      expect(result).toBe('esm'); // File extension should win
    });
  });
});
