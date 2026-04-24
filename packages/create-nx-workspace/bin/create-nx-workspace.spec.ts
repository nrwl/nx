import {
  validateWorkspaceName,
  resolveSpecialFolderName,
  determineFolder,
} from './create-nx-workspace';
import { CnwError } from '../src/utils/error-utils';
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from 'fs';
import { join, basename, dirname } from 'path';
import { tmpdir } from 'os';

describe('validateWorkspaceName', () => {
  it('should allow names starting with a letter', () => {
    expect(() => validateWorkspaceName('myapp')).not.toThrow();
    expect(() => validateWorkspaceName('MyApp')).not.toThrow();
    expect(() => validateWorkspaceName('my-app')).not.toThrow();
    expect(() => validateWorkspaceName('my_app')).not.toThrow();
    expect(() => validateWorkspaceName('app123')).not.toThrow();
  });

  it('should reject names starting with a number', () => {
    expect(() => validateWorkspaceName('4name')).toThrow(CnwError);
    expect(() => validateWorkspaceName('123app')).toThrow(CnwError);
    expect(() => validateWorkspaceName('0test')).toThrow(CnwError);
  });

  it('should reject names starting with special characters', () => {
    expect(() => validateWorkspaceName('-app')).toThrow(CnwError);
    expect(() => validateWorkspaceName('_app')).toThrow(CnwError);
    expect(() => validateWorkspaceName('@app')).toThrow(CnwError);
  });

  it('should throw CnwError with INVALID_WORKSPACE_NAME code', () => {
    try {
      validateWorkspaceName('4name');
      fail('Expected CnwError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CnwError);
      expect((e as CnwError).code).toBe('INVALID_WORKSPACE_NAME');
      expect((e as CnwError).message).toContain('4name');
      expect((e as CnwError).message).toContain(
        'Workspace names must start with a letter'
      );
    }
  });
});

describe('determineFolder', () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  function makeParsedArgs(
    overrides: Partial<{
      name: string;
      positional: string;
      interactive: boolean;
    }> = {}
  ) {
    return {
      _: overrides.positional ? [overrides.positional] : [],
      $0: 'create-nx-workspace',
      name: overrides.name ?? '',
      interactive: overrides.interactive ?? false,
    } as any;
  }

  it('should return directory basename for "." in non-interactive mode', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);

    const parsedArgs = makeParsedArgs({ positional: '.', interactive: false });
    const result = await determineFolder(parsedArgs);

    expect(result).toBe(basename(tmpDir));
    expect(parsedArgs.workingDir).toBe(dirname(tmpDir));

    rmSync(tmpDir, { recursive: true });
  });

  it('should return directory basename for "./" in non-interactive mode', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);

    const parsedArgs = makeParsedArgs({ positional: './', interactive: false });
    const result = await determineFolder(parsedArgs);

    expect(result).toBe(basename(tmpDir));
    expect(parsedArgs.workingDir).toBe(dirname(tmpDir));

    rmSync(tmpDir, { recursive: true });
  });

  it('should return directory basename for "." in interactive mode', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);

    const parsedArgs = makeParsedArgs({ positional: '.', interactive: true });
    const result = await determineFolder(parsedArgs);

    expect(result).toBe(basename(tmpDir));

    rmSync(tmpDir, { recursive: true });
  });

  it('should default to directory basename when no name given in non-interactive mode', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);

    const parsedArgs = makeParsedArgs({ interactive: false });
    const result = await determineFolder(parsedArgs);

    expect(result).toBe(basename(tmpDir));

    rmSync(tmpDir, { recursive: true });
  });

  it('should return the name directly when it does not exist as a directory', async () => {
    const parsedArgs = makeParsedArgs({
      positional: 'nonexistent-workspace-name',
      interactive: false,
    });
    const result = await determineFolder(parsedArgs);

    expect(result).toBe('nonexistent-workspace-name');
  });

  it('should throw DIRECTORY_EXISTS for an existing directory name in non-interactive mode', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    const existing = join(tmpDir, 'existing');
    mkdirSync(existing);
    process.chdir(tmpDir);

    const parsedArgs = makeParsedArgs({
      positional: 'existing',
      interactive: false,
    });

    await expect(determineFolder(parsedArgs)).rejects.toThrow(CnwError);
    await expect(determineFolder(parsedArgs)).rejects.toThrow(/already exists/);

    rmSync(tmpDir, { recursive: true });
  });
});

describe('resolveSpecialFolderName', () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('should return null for regular names', () => {
    expect(resolveSpecialFolderName('myapp')).toBeNull();
    expect(resolveSpecialFolderName('my-app')).toBeNull();
    expect(resolveSpecialFolderName('app123')).toBeNull();
  });

  describe('"." and "./"', () => {
    it('should throw DIRECTORY_EXISTS when cwd is non-empty', () => {
      // cwd is the repo root, which is definitely non-empty
      try {
        resolveSpecialFolderName('.');
        fail('Expected CnwError to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CnwError);
        expect((e as CnwError).code).toBe('DIRECTORY_EXISTS');
        expect((e as CnwError).message).toContain('nx init');
      }
    });

    it('should throw DIRECTORY_EXISTS for "./" in non-empty directory', () => {
      try {
        resolveSpecialFolderName('./');
        fail('Expected CnwError to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CnwError);
        expect((e as CnwError).code).toBe('DIRECTORY_EXISTS');
      }
    });

    it('should resolve "." to basename and parent workingDir when cwd is empty', () => {
      const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
      process.chdir(tmpDir);

      const result = resolveSpecialFolderName('.');

      expect(result).toEqual({
        name: basename(tmpDir),
        workingDir: dirname(tmpDir),
      });

      rmSync(tmpDir, { recursive: true });
    });

    it('should resolve "./" to basename and parent workingDir when cwd is empty', () => {
      const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
      process.chdir(tmpDir);

      const result = resolveSpecialFolderName('./');

      expect(result).toEqual({
        name: basename(tmpDir),
        workingDir: dirname(tmpDir),
      });

      rmSync(tmpDir, { recursive: true });
    });
  });

  describe('absolute paths', () => {
    it('should extract basename and return parent as workingDir', () => {
      const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
      const targetPath = join(tmpDir, 'acme');

      const result = resolveSpecialFolderName(targetPath);

      expect(result).toEqual({ name: 'acme', workingDir: tmpDir });

      rmSync(tmpDir, { recursive: true });
    });

    it('should throw INVALID_PATH when parent directory does not exist', () => {
      try {
        resolveSpecialFolderName('/nonexistent-parent-dir-xyz/acme');
        fail('Expected CnwError to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CnwError);
        expect((e as CnwError).code).toBe('INVALID_PATH');
        expect((e as CnwError).message).toContain('does not exist');
      }
    });

    it('should work when target directory already exists', () => {
      const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
      const targetPath = join(tmpDir, 'existing');
      mkdirSync(targetPath);

      const result = resolveSpecialFolderName(targetPath);

      expect(result).toEqual({ name: 'existing', workingDir: tmpDir });

      rmSync(tmpDir, { recursive: true });
    });
  });
});
