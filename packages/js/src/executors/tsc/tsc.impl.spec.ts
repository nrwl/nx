import { ExecutorContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import * as ts from 'typescript';
import { ExecutorOptions } from '../../utils/schema';
import { readTsConfig } from '../../utils/typescript/ts-config';
import { normalizeOptions } from './lib';
import {
  createTypeScriptCompilationOptions,
  determineModuleFormatFromTsConfig,
} from './tsc.impl';

jest.mock('../../utils/typescript/ts-config');

const mockReadTsConfig = readTsConfig as jest.MockedFunction<
  typeof readTsConfig
>;

describe('tscExecutor', () => {
  let context: ExecutorContext;
  let testOptions: ExecutorOptions;

  beforeEach(async () => {
    context = {
      root: '/root',
      cwd: '/root',
      projectGraph: {
        nodes: {},
        dependencies: {},
      },
      projectsConfigurations: {
        version: 2,
        projects: {},
      },
      nxJsonConfiguration: {},
      isVerbose: false,
      projectName: 'example',
      targetName: 'build',
    };
    testOptions = {
      main: 'libs/ui/src/index.ts',
      outputPath: 'dist/libs/ui',
      tsConfig: 'libs/ui/tsconfig.json',
      assets: [],
      transformers: [],
      watch: false,
      clean: true,
    };
  });

  describe('createTypeScriptCompilationOptions', () => {
    it('should create typescript compilation options for valid config', () => {
      const result = createTypeScriptCompilationOptions(
        normalizeOptions(testOptions, '/root', 'libs/ui/src', 'libs/ui'),
        context
      );

      expect(result).toMatchObject({
        outputPath: '/root/dist/libs/ui',
        projectName: 'example',
        projectRoot: 'libs/ui',
        rootDir: '/root/libs/ui',
        tsConfig: '/root/libs/ui/tsconfig.json',
        watch: false,
        deleteOutputPath: true,
      });
    });

    it('should handle custom rootDir', () => {
      const result = createTypeScriptCompilationOptions(
        normalizeOptions(
          { ...testOptions, rootDir: 'libs/ui/src' },
          '/root',
          'libs/ui/src',
          'libs/ui'
        ),
        context
      );

      expect(result).toMatchObject({
        rootDir: '/root/libs/ui/src',
      });
    });
  });
});

describe('determineModuleFormatFromTsConfig', () => {
  let tempFs: TempFs;
  let workspaceRoot: string;

  beforeEach(async () => {
    jest.resetAllMocks();
    tempFs = new TempFs('tsc-module-format');
    workspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  describe('ESM module kinds', () => {
    it('should return esm for ES2015 module', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.ES2015 },
      } as any);

      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`
      );

      expect(result).toBe('esm');
    });

    it('should return esm for ES2020 module', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.ES2020 },
      } as any);

      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`
      );

      expect(result).toBe('esm');
    });

    it('should return esm for ES2022 module', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.ES2022 },
      } as any);

      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`
      );

      expect(result).toBe('esm');
    });

    it('should return esm for ESNext module', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.ESNext },
      } as any);

      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`
      );

      expect(result).toBe('esm');
    });
  });

  describe('CJS module kinds', () => {
    it('should return cjs for CommonJS module', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.CommonJS },
      } as any);

      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`
      );

      expect(result).toBe('cjs');
    });
  });

  describe('NodeNext module kind', () => {
    it('should return esm for NodeNext when package.json has type: module', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
        'libs/ui/package.json': JSON.stringify({ type: 'module' }),
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.NodeNext },
      } as any);

      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`,
        'libs/ui',
        workspaceRoot
      );

      expect(result).toBe('esm');
    });

    it('should return cjs for NodeNext when package.json has type: commonjs', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
        'libs/ui/package.json': JSON.stringify({ type: 'commonjs' }),
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.NodeNext },
      } as any);

      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`,
        'libs/ui',
        workspaceRoot
      );

      expect(result).toBe('cjs');
    });

    it('should return cjs for NodeNext when package.json has no type field', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
        'libs/ui/package.json': JSON.stringify({ name: 'test' }),
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.NodeNext },
      } as any);

      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`,
        'libs/ui',
        workspaceRoot
      );

      expect(result).toBe('cjs');
    });

    it('should return cjs for NodeNext when package.json does not exist', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.NodeNext },
      } as any);

      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`,
        'libs/ui',
        workspaceRoot
      );

      expect(result).toBe('cjs');
    });

    it('should return cjs for NodeNext when projectRoot/workspaceRoot not provided (backward compatible)', () => {
      tempFs.createFilesSync({
        'libs/ui/tsconfig.json': '{}',
        'libs/ui/package.json': JSON.stringify({ type: 'module' }),
      });

      mockReadTsConfig.mockReturnValue({
        options: { module: ts.ModuleKind.NodeNext },
      } as any);

      // Without projectRoot and workspaceRoot, should default to cjs
      const result = determineModuleFormatFromTsConfig(
        `${workspaceRoot}/libs/ui/tsconfig.json`
      );

      expect(result).toBe('cjs');
    });
  });
});
