import {
  validateWorkspaceName,
  resolveSpecialFolderName,
  determineFolder,
  isFunctionallyEmpty,
} from './create-nx-workspace';
import { CnwError } from '../src/utils/error-utils';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  realpathSync,
  writeFileSync,
} from 'fs';
import { join, basename, dirname } from 'path';
import { tmpdir } from 'os';

jest.mock('enquirer', () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

jest.mock('../src/utils/ci/is-ci', () => ({
  isCI: jest.fn(() => false),
}));

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
    expect(parsedArgs.useCurrentDir).toBe(true);

    rmSync(tmpDir, { recursive: true });
  });

  it('should resolve "." in a functionally empty dir (only .git/README/LICENSE)', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    mkdirSync(join(tmpDir, '.git'));
    writeFileSync(join(tmpDir, '.gitignore'), 'node_modules\n');
    writeFileSync(join(tmpDir, 'README.md'), '# repo\n');
    writeFileSync(join(tmpDir, 'LICENSE'), 'MIT\n');
    process.chdir(tmpDir);

    const parsedArgs = makeParsedArgs({ positional: '.', interactive: false });
    const result = await determineFolder(parsedArgs);

    expect(result).toBe(basename(tmpDir));
    expect(parsedArgs.workingDir).toBe(dirname(tmpDir));
    expect(parsedArgs.useCurrentDir).toBe(true);

    rmSync(tmpDir, { recursive: true });
  });

  it('should throw DIRECTORY_EXISTS for "." when cwd has real files', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    process.chdir(tmpDir);

    const parsedArgs = makeParsedArgs({ positional: '.', interactive: false });

    await expect(determineFolder(parsedArgs)).rejects.toThrow(CnwError);
    await expect(determineFolder(parsedArgs)).rejects.toThrow(/nx init/);

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

  it('should return directory basename for "." in interactive mode after confirm', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);
    (require('enquirer').default.prompt as jest.Mock).mockResolvedValueOnce({
      useCurrentDir: 'Yes',
    });

    const parsedArgs = makeParsedArgs({ positional: '.', interactive: true });
    const result = await determineFolder(parsedArgs);

    expect(result).toBe(basename(tmpDir));
    expect(parsedArgs.useCurrentDir).toBe(true);

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

describe('isFunctionallyEmpty', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-empty-')));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it('should be true for an empty directory', () => {
    expect(isFunctionallyEmpty(tmpDir)).toBe(true);
  });

  it('should be true for a fresh GitHub repo (.git, .gitignore, README, LICENSE)', () => {
    mkdirSync(join(tmpDir, '.git'));
    mkdirSync(join(tmpDir, '.github'));
    writeFileSync(join(tmpDir, '.gitignore'), 'node_modules\n');
    writeFileSync(join(tmpDir, '.gitattributes'), '* text=auto\n');
    writeFileSync(join(tmpDir, 'README.md'), '# repo\n');
    writeFileSync(join(tmpDir, 'LICENSE'), 'MIT\n');
    expect(isFunctionallyEmpty(tmpDir)).toBe(true);
  });

  it('should allow README and LICENSE in any case/extension', () => {
    writeFileSync(join(tmpDir, 'readme.txt'), 'x\n');
    writeFileSync(join(tmpDir, 'License.md'), 'x\n');
    writeFileSync(join(tmpDir, 'LICENCE'), 'x\n');
    expect(isFunctionallyEmpty(tmpDir)).toBe(true);
  });

  it('should be false when a real source file is present', () => {
    writeFileSync(join(tmpDir, 'index.ts'), 'export {};\n');
    expect(isFunctionallyEmpty(tmpDir)).toBe(false);
  });

  it('should be false when package.json is present', () => {
    writeFileSync(join(tmpDir, 'README.md'), '# repo\n');
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    expect(isFunctionallyEmpty(tmpDir)).toBe(false);
  });

  it('should be false when a non-dot source directory is present', () => {
    mkdirSync(join(tmpDir, 'src'));
    expect(isFunctionallyEmpty(tmpDir)).toBe(false);
  });

  it('should be false for a directory named README/LICENSE (only files are inert)', () => {
    mkdirSync(join(tmpDir, 'README'));
    expect(isFunctionallyEmpty(tmpDir)).toBe(false);
  });

  it('should ignore a node_modules directory', () => {
    mkdirSync(join(tmpDir, 'node_modules'));
    writeFileSync(join(tmpDir, 'README.md'), '# repo\n');
    expect(isFunctionallyEmpty(tmpDir)).toBe(true);
  });

  it('should still be false when node_modules sits next to real source', () => {
    mkdirSync(join(tmpDir, 'node_modules'));
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    expect(isFunctionallyEmpty(tmpDir)).toBe(false);
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

    it('should resolve "." when cwd only holds inert files (.git/README/LICENSE)', () => {
      const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
      mkdirSync(join(tmpDir, '.git'));
      writeFileSync(join(tmpDir, 'README.md'), '# repo\n');
      writeFileSync(join(tmpDir, 'LICENSE'), 'MIT\n');
      process.chdir(tmpDir);

      const result = resolveSpecialFolderName('.');

      expect(result).toEqual({
        name: basename(tmpDir),
        workingDir: dirname(tmpDir),
      });

      rmSync(tmpDir, { recursive: true });
    });

    it('should throw DIRECTORY_EXISTS when cwd has real files', () => {
      const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
      writeFileSync(join(tmpDir, 'index.ts'), 'export {};\n');
      process.chdir(tmpDir);

      try {
        resolveSpecialFolderName('.');
        fail('Expected CnwError to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CnwError);
        expect((e as CnwError).code).toBe('DIRECTORY_EXISTS');
        expect((e as CnwError).message).toContain('nx init');
      } finally {
        rmSync(tmpDir, { recursive: true });
      }
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

describe('determineFolder - interactive current directory prompt', () => {
  const enquirer = require('enquirer').default;
  const { isCI } = require('../src/utils/ci/is-ci');
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    (enquirer.prompt as jest.Mock).mockReset();
    (isCI as jest.Mock).mockReset().mockReturnValue(false);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  function noNameArgs() {
    return {
      _: [],
      $0: 'create-nx-workspace',
      name: '',
      interactive: true,
    } as any;
  }

  it('scaffolds in place when the user confirms', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);
    (enquirer.prompt as jest.Mock).mockResolvedValueOnce({
      useCurrentDir: 'Yes',
    });

    const parsedArgs = noNameArgs();
    const result = await determineFolder(parsedArgs);

    expect(result).toBe(basename(tmpDir));
    expect(parsedArgs.workingDir).toBe(dirname(tmpDir));
    expect(parsedArgs.useCurrentDir).toBe(true);
    expect(enquirer.prompt).toHaveBeenCalledTimes(1);

    rmSync(tmpDir, { recursive: true });
  });

  it('falls back to the name prompt when the user declines', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);
    (enquirer.prompt as jest.Mock)
      .mockResolvedValueOnce({ useCurrentDir: 'No' })
      .mockResolvedValueOnce({ folderName: 'myorg' });

    const parsedArgs = noNameArgs();
    const result = await determineFolder(parsedArgs);

    expect(result).toBe('myorg');
    expect(parsedArgs.useCurrentDir).toBeUndefined();
    expect(enquirer.prompt).toHaveBeenCalledTimes(2);

    rmSync(tmpDir, { recursive: true });
  });

  it('does not offer the current directory when it has real files', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    process.chdir(tmpDir);
    (enquirer.prompt as jest.Mock).mockResolvedValueOnce({
      folderName: 'myorg',
    });

    const parsedArgs = noNameArgs();
    const result = await determineFolder(parsedArgs);

    expect(result).toBe('myorg');
    // Only the folder-name prompt ran, not the current-directory confirm.
    expect(enquirer.prompt).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify((enquirer.prompt as jest.Mock).mock.calls[0][0])
    ).not.toContain('current directory');

    rmSync(tmpDir, { recursive: true });
  });

  it('confirms before scaffolding into the current dir for an explicit "." and falls back to a subfolder on decline', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);
    (enquirer.prompt as jest.Mock)
      .mockResolvedValueOnce({ useCurrentDir: 'No' })
      .mockResolvedValueOnce({ folderName: 'myorg' });

    const parsedArgs = {
      _: ['.'],
      $0: 'create-nx-workspace',
      name: '',
      interactive: true,
    } as any;
    const result = await determineFolder(parsedArgs);

    expect(result).toBe('myorg');
    // Declined in-place -> not a current-dir scaffold, and workingDir cleared
    // so the subfolder lands under the cwd.
    expect(parsedArgs.useCurrentDir).toBeFalsy();
    expect(parsedArgs.workingDir).toBeUndefined();
    expect(enquirer.prompt).toHaveBeenCalledTimes(2);

    rmSync(tmpDir, { recursive: true });
  });
});
