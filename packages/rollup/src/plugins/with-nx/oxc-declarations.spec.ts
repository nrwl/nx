import { oxcDeclarations } from './oxc-declarations';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock oxc-transform since it has native bindings that Jest can't load
jest.mock('oxc-transform', () => ({
  isolatedDeclaration: jest.fn(
    async (filename: string, source: string, _options?: any) => {
      // Simple mock that converts TS source to a minimal .d.ts
      // by wrapping exported functions/interfaces in declare statements
      let code = '';
      if (source.includes('export function')) {
        const match = source.match(/export function (\w+)\(([^)]*)\):\s*(\w+)/);
        if (match) {
          code = `export declare function ${match[1]}(${match[2]}): ${match[3]};\n`;
        }
      }
      if (source.includes('export interface')) {
        // Pass through interface declarations as-is (they're already type-only)
        code += source.replace(/export interface/g, 'export declare interface');
      }
      return { code, map: null };
    }
  ),
}));

describe('oxcDeclarations', () => {
  let testDir: string;
  let srcDir: string;
  let outDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `oxc-decl-test-${Date.now()}`);
    srcDir = join(testDir, 'src');
    outDir = join(testDir, 'dist');
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create a plugin with the correct name', () => {
    const plugin = oxcDeclarations({ projectRoot: testDir });
    expect(plugin.name).toBe('nx-oxc-declarations');
  });

  it('should generate .d.ts for a chunk with a .ts source', async () => {
    writeFileSync(
      join(srcDir, 'index.ts'),
      `export function greet(name: string): string { return 'Hello ' + name; }\n`
    );

    const plugin = oxcDeclarations({
      projectRoot: testDir,
      sourceRoot: srcDir,
    });

    const mockContext = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    const bundle = {
      'index.js': {
        type: 'chunk' as const,
        facadeModuleId: join(srcDir, 'index.ts'),
        isEntry: true,
        fileName: 'index.js',
        exports: [],
        modules: {},
        code: '',
        isDynamicEntry: false,
        isImplicitEntry: false,
        moduleIds: [],
        importedBindings: {},
        imports: [],
        dynamicImports: [],
        referencedFiles: [],
        implicitlyLoadedBefore: [],
        map: null,
        name: 'index',
        preliminaryFileName: 'index.js',
        sourcemapFileName: null,
      },
    };

    await plugin.writeBundle.call(mockContext, { dir: outDir }, bundle as any);

    const dtsPath = join(outDir, 'index.d.ts');
    expect(existsSync(dtsPath)).toBe(true);

    const content = readFileSync(dtsPath, 'utf-8');
    expect(content).toContain('greet');
    expect(content).toContain('declare');
    expect(mockContext.error).not.toHaveBeenCalled();
  });

  it('should generate .d.ts for tree-shaken type-only files', async () => {
    writeFileSync(
      join(srcDir, 'types.ts'),
      `export interface User { name: string; age: number; }\n`
    );

    const plugin = oxcDeclarations({
      projectRoot: testDir,
      sourceRoot: srcDir,
    });

    const mockContext = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Empty bundle — simulating that types.ts was tree-shaken
    await plugin.writeBundle.call(mockContext, { dir: outDir }, {} as any);

    const dtsPath = join(outDir, 'src', 'types.d.ts');
    expect(existsSync(dtsPath)).toBe(true);

    const content = readFileSync(dtsPath, 'utf-8');
    expect(content).toContain('User');
    expect(content).toContain('interface');
  });

  it('should skip non-.ts chunks', async () => {
    const plugin = oxcDeclarations({
      projectRoot: testDir,
      sourceRoot: srcDir,
    });

    const mockContext = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    const bundle = {
      'index.js': {
        type: 'chunk' as const,
        facadeModuleId: join(srcDir, 'index.js'),
        isEntry: true,
        fileName: 'index.js',
        exports: [],
        modules: {},
        code: '',
        isDynamicEntry: false,
        isImplicitEntry: false,
        moduleIds: [],
        importedBindings: {},
        imports: [],
        dynamicImports: [],
        referencedFiles: [],
        implicitlyLoadedBefore: [],
        map: null,
        name: 'index',
        preliminaryFileName: 'index.js',
        sourcemapFileName: null,
      },
    };

    await plugin.writeBundle.call(mockContext, { dir: outDir }, bundle as any);

    const dtsPath = join(outDir, 'index.d.ts');
    expect(existsSync(dtsPath)).toBe(false);
  });

  it('should skip .spec.ts and .test.ts files in tree walk', async () => {
    writeFileSync(
      join(srcDir, 'utils.spec.ts'),
      `export function testHelper(): void {}\n`
    );
    writeFileSync(
      join(srcDir, 'utils.test.ts'),
      `export function testHelper2(): void {}\n`
    );

    const plugin = oxcDeclarations({
      projectRoot: testDir,
      sourceRoot: srcDir,
    });

    const mockContext = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    await plugin.writeBundle.call(mockContext, { dir: outDir }, {} as any);

    expect(existsSync(join(outDir, 'src', 'utils.spec.d.ts'))).toBe(false);
    expect(existsSync(join(outDir, 'src', 'utils.test.d.ts'))).toBe(false);
  });

  it('should warn when source file is not found', async () => {
    const plugin = oxcDeclarations({
      projectRoot: testDir,
      sourceRoot: srcDir,
    });

    const mockContext = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    const bundle = {
      'index.js': {
        type: 'chunk' as const,
        facadeModuleId: join(srcDir, 'nonexistent.ts'),
        isEntry: true,
        fileName: 'index.js',
        exports: [],
        modules: {},
        code: '',
        isDynamicEntry: false,
        isImplicitEntry: false,
        moduleIds: [],
        importedBindings: {},
        imports: [],
        dynamicImports: [],
        referencedFiles: [],
        implicitlyLoadedBefore: [],
        map: null,
        name: 'index',
        preliminaryFileName: 'index.js',
        sourcemapFileName: null,
      },
    };

    await plugin.writeBundle.call(mockContext, { dir: outDir }, bundle as any);

    expect(mockContext.warn).toHaveBeenCalledWith(
      expect.stringContaining('Source file not found')
    );
  });

  it('should skip chunks without facadeModuleId', async () => {
    const plugin = oxcDeclarations({
      projectRoot: testDir,
      sourceRoot: srcDir,
    });

    const mockContext = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    const bundle = {
      'chunk-abc.js': {
        type: 'chunk' as const,
        facadeModuleId: null,
        isEntry: false,
        fileName: 'chunk-abc.js',
        exports: [],
        modules: {},
        code: '',
        isDynamicEntry: false,
        isImplicitEntry: false,
        moduleIds: [],
        importedBindings: {},
        imports: [],
        dynamicImports: [],
        referencedFiles: [],
        implicitlyLoadedBefore: [],
        map: null,
        name: 'chunk-abc',
        preliminaryFileName: 'chunk-abc.js',
        sourcemapFileName: null,
      },
    };

    await plugin.writeBundle.call(mockContext, { dir: outDir }, bundle as any);

    expect(existsSync(join(outDir, 'chunk-abc.d.ts'))).toBe(false);
    expect(mockContext.error).not.toHaveBeenCalled();
  });

  it('should not regenerate .d.ts files already created in phase 1', async () => {
    // Create a source file that will be both a bundle entry and in the source tree
    writeFileSync(
      join(srcDir, 'index.ts'),
      `export function greet(name: string): string { return 'Hello ' + name; }\n`
    );

    const plugin = oxcDeclarations({
      projectRoot: testDir,
      sourceRoot: srcDir,
    });

    const { isolatedDeclaration } = require('oxc-transform');
    (isolatedDeclaration as jest.Mock).mockClear();

    const mockContext = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    const bundle = {
      'src/index.js': {
        type: 'chunk' as const,
        facadeModuleId: join(srcDir, 'index.ts'),
        isEntry: true,
        fileName: 'src/index.js',
        exports: [],
        modules: {},
        code: '',
        isDynamicEntry: false,
        isImplicitEntry: false,
        moduleIds: [],
        importedBindings: {},
        imports: [],
        dynamicImports: [],
        referencedFiles: [],
        implicitlyLoadedBefore: [],
        map: null,
        name: 'index',
        preliminaryFileName: 'src/index.js',
        sourcemapFileName: null,
      },
    };

    await plugin.writeBundle.call(mockContext, { dir: outDir }, bundle as any);

    // Phase 1 creates dist/src/index.d.ts
    // Phase 2 should skip it since it already exists
    expect(isolatedDeclaration).toHaveBeenCalledTimes(1);
  });
});
