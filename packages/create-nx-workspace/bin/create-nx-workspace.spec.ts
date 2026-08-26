import {
  applyEmptyPresetAlias,
  validateWorkspaceName,
  resolveSpecialFolderName,
  determineFolder,
  determinePresetOptions,
} from './create-nx-workspace';
import * as clack from '@clack/prompts';
import { CnwError } from '../src/utils/error-utils';
import { Preset } from '../src/utils/preset/preset';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  realpathSync,
  writeFileSync,
} from 'fs';
import { join, basename, dirname } from 'path';
import { tmpdir } from 'os';

jest.mock('@clack/prompts', () => ({
  __esModule: true,
  autocomplete: jest.fn(),
  text: jest.fn(),
  isCancel: jest.fn(() => false),
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

  it('should scaffold "." in place even when the cwd is not empty', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    mkdirSync(join(tmpDir, 'src'));
    process.chdir(tmpDir);

    const parsedArgs = makeParsedArgs({ positional: '.', interactive: false });
    const result = await determineFolder(parsedArgs);

    expect(result).toBe(basename(tmpDir));
    expect(parsedArgs.workingDir).toBe(dirname(tmpDir));
    expect(parsedArgs.useCurrentDir).toBe(true);

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
    it('should resolve "." to basename and parent workingDir', () => {
      const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
      process.chdir(tmpDir);

      expect(resolveSpecialFolderName('.')).toEqual({
        name: basename(tmpDir),
        workingDir: dirname(tmpDir),
      });

      rmSync(tmpDir, { recursive: true });
    });

    it('should resolve "./" to basename and parent workingDir', () => {
      const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
      process.chdir(tmpDir);

      expect(resolveSpecialFolderName('./')).toEqual({
        name: basename(tmpDir),
        workingDir: dirname(tmpDir),
      });

      rmSync(tmpDir, { recursive: true });
    });

    it('should resolve "." regardless of the cwd contents', () => {
      const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
      writeFileSync(join(tmpDir, 'package.json'), '{}');
      mkdirSync(join(tmpDir, 'src'));
      process.chdir(tmpDir);

      expect(resolveSpecialFolderName('.')).toEqual({
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

describe('determineFolder - explicit "." confirmation', () => {
  const { isCI } = require('../src/utils/ci/is-ci');
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    (clack.autocomplete as jest.Mock).mockReset();
    (clack.text as jest.Mock).mockReset();
    (isCI as jest.Mock).mockReset().mockReturnValue(false);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  function dotArgs() {
    return {
      _: ['.'],
      $0: 'create-nx-workspace',
      name: '',
      interactive: true,
    } as any;
  }

  it('scaffolds in place when the user confirms', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);
    (clack.autocomplete as jest.Mock).mockResolvedValueOnce('Yes');

    const parsedArgs = dotArgs();
    const result = await determineFolder(parsedArgs);

    expect(result).toBe(basename(tmpDir));
    expect(parsedArgs.workingDir).toBe(dirname(tmpDir));
    expect(parsedArgs.useCurrentDir).toBe(true);
    expect(clack.autocomplete).toHaveBeenCalledTimes(1);

    rmSync(tmpDir, { recursive: true });
  });

  it('falls back to a named subfolder when the user declines', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-test-')));
    process.chdir(tmpDir);
    (clack.autocomplete as jest.Mock).mockResolvedValueOnce('No');
    (clack.text as jest.Mock).mockResolvedValueOnce('myorg');

    const parsedArgs = dotArgs();
    const result = await determineFolder(parsedArgs);

    expect(result).toBe('myorg');
    // Declined in-place -> not a current-dir scaffold, and workingDir cleared
    // so the subfolder lands under the cwd.
    expect(parsedArgs.useCurrentDir).toBeFalsy();
    expect(parsedArgs.workingDir).toBeUndefined();
    expect(clack.autocomplete).toHaveBeenCalledTimes(1);
    expect(clack.text).toHaveBeenCalledTimes(1);

    rmSync(tmpDir, { recursive: true });
  });
});

describe('applyEmptyPresetAlias', () => {
  it('maps --preset empty to the ts preset', () => {
    const argv = { preset: 'empty' as const };
    applyEmptyPresetAlias(argv);
    expect(argv.preset).toBe('ts');
  });

  it('wins over --template so appending --preset=empty escapes the template download', () => {
    const argv = { preset: 'empty' as const, template: 'nrwl/react-template' };
    applyEmptyPresetAlias(argv);
    expect(argv).toEqual({ preset: 'ts' });
  });

  it('leaves other presets and templates untouched', () => {
    const preset = { preset: Preset.ReactMonorepo };
    applyEmptyPresetAlias(preset);
    expect(preset).toEqual({ preset: 'react-monorepo' });

    const template = { template: 'empty' };
    applyEmptyPresetAlias(template);
    expect(template).toEqual({ template: 'empty' });
  });
});

describe('determinePresetOptions', () => {
  const base = {
    _: [],
    $0: '',
    interactive: false,
    workspaces: true,
    name: 'myorg',
    // Values neither resolution can produce on its own while `interactive` is
    // false, so these tests pin the threading through each stack rather than the
    // resolved default.
    linter: 'oxlint',
    formatter: 'oxfmt',
  } as any;

  beforeEach(() => {
    // Recorded calls persist across tests otherwise, so any assertion on which
    // questions were asked would see every earlier test's prompts too.
    (clack.autocomplete as jest.Mock).mockClear();
  });

  // Every stack must come back with the resolved linter. Once the schemas
  // stopped defaulting it, a stack that dropped it produced an unlinted
  // workspace with no prompt and no error.
  // Each stack needs enough non-interactive args to reach its return statement.
  const perStack: Record<string, Record<string, unknown>> = {
    none: { preset: Preset.TsStandalone },
    web: { preset: Preset.WebComponents },
    react: {
      preset: Preset.ReactMonorepo,
      appName: 'app',
      framework: 'none',
      style: 'css',
      bundler: 'vite',
      unitTestRunner: 'vitest',
      e2eTestRunner: 'playwright',
      useReactRouter: false,
      workspaceType: 'integrated',
    },
    angular: {
      preset: Preset.AngularMonorepo,
      appName: 'app',
      style: 'css',
      bundler: 'esbuild',
      unitTestRunner: 'jest',
      e2eTestRunner: 'playwright',
      standaloneApi: true,
      routing: true,
      ssr: false,
      prefix: 'app',
      zoneless: true,
      workspaceType: 'integrated',
    },
    vue: {
      preset: Preset.VueMonorepo,
      appName: 'app',
      framework: 'none',
      style: 'css',
      unitTestRunner: 'vitest',
      e2eTestRunner: 'playwright',
      workspaceType: 'integrated',
    },
    node: {
      preset: Preset.NodeMonorepo,
      appName: 'app',
      framework: 'none',
      docker: false,
      unitTestRunner: 'jest',
      e2eTestRunner: 'jest',
      workspaceType: 'integrated',
    },
  };

  it.each(Object.keys(perStack))(
    'should thread the resolved linter through the %s stack',
    async (stack) => {
      const result = await determinePresetOptions({
        ...base,
        stack,
        ...perStack[stack],
      } as any);

      expect(result.linter).toBe('oxlint');
    }
  );

  it.each(Object.keys(perStack))(
    'should thread the resolved formatter through the %s stack',
    async (stack) => {
      const result = await determinePresetOptions({
        ...base,
        stack,
        ...perStack[stack],
      } as any);

      expect(result.formatter).toBe('oxfmt');
    }
  );

  // `--no-workspaces` is the case the formatter used to answer for the user:
  // it took a hardcoded `prettier` while the linter was already asked. Pinning
  // both here is what stops that gate coming back.
  it.each(Object.keys(perStack))(
    'should thread linter and formatter through the %s stack without workspaces',
    async (stack) => {
      const result = await determinePresetOptions({
        ...base,
        workspaces: false,
        stack,
        ...perStack[stack],
      } as any);

      expect(result.linter).toBe('oxlint');
      expect(result.formatter).toBe('oxfmt');
    }
  );

  it('should keep an explicitly passed linter', async () => {
    const result = await determinePresetOptions({
      ...base,
      stack: 'angular',
      ...perStack.angular,
      linter: 'eslint',
    } as any);

    expect(result.linter).toBe('eslint');
  });

  it('should resolve a linter for the web stack', async () => {
    const result = await determinePresetOptions({
      ...base,
      stack: 'web',
      preset: Preset.WebComponents,
    } as any);

    expect(result.linter).toBe('oxlint');
  });

  // `apps`, `ts` and `npm` reach no generator that takes a linter, so asking
  // would put the question to the user and then discard the answer.
  it.each([Preset.Apps, Preset.NPM, Preset.TS])(
    'should not ask for a linter when %s cannot use one',
    async (preset) => {
      const result = await determinePresetOptions({
        ...base,
        stack: 'none',
        preset,
      } as any);

      expect(result.linter).toBeUndefined();
      const linterQuestions = (
        clack.autocomplete as jest.Mock
      ).mock.calls.filter(([question]) =>
        String(question?.message ?? '').includes('linter')
      );
      expect(linterQuestions).toHaveLength(0);
    }
  );
});

// The choice list is ordered, not just filtered: the leading entry is both the
// interactive default and the answer a skipped prompt resolves to. A rewrite
// that dropped the ordering sent every non-interactive workspace to `none`.
describe('determineUnitTestRunner', () => {
  const base = {
    interactive: false,
    workspaces: true,
    name: 'myorg',
    linter: 'oxlint',
  } as any;

  const stacks: Record<
    string,
    { args: Record<string, unknown>; expected: string; excluded: string }
  > = {
    'react (vite)': {
      args: {
        stack: 'react',
        preset: Preset.ReactMonorepo,
        appName: 'app',
        framework: 'none',
        style: 'css',
        bundler: 'vite',
        e2eTestRunner: 'playwright',
        useReactRouter: false,
        workspaceType: 'integrated',
      },
      expected: 'vitest',
      excluded: '',
    },
    'react (webpack)': {
      args: {
        stack: 'react',
        preset: Preset.ReactMonorepo,
        appName: 'app',
        framework: 'none',
        style: 'css',
        bundler: 'webpack',
        e2eTestRunner: 'playwright',
        useReactRouter: false,
        workspaceType: 'integrated',
      },
      expected: 'jest',
      excluded: '',
    },
    vue: {
      args: {
        stack: 'vue',
        preset: Preset.VueMonorepo,
        appName: 'app',
        framework: 'none',
        style: 'css',
        e2eTestRunner: 'playwright',
        workspaceType: 'integrated',
      },
      expected: 'vitest',
      excluded: 'jest',
    },
    node: {
      args: {
        stack: 'node',
        preset: Preset.NodeMonorepo,
        appName: 'app',
        framework: 'none',
        docker: false,
        e2eTestRunner: 'jest',
        workspaceType: 'integrated',
      },
      expected: 'jest',
      excluded: '',
    },
  };

  beforeEach(() => {
    (clack.autocomplete as jest.Mock).mockClear();
  });

  it.each(Object.keys(stacks))(
    'should answer %s with its preferred runner when not interactive',
    async (stack) => {
      const { args, expected } = stacks[stack];

      const result = await determinePresetOptions({ ...base, ...args } as any);

      expect(result.unitTestRunner).toBe(expected);
    }
  );

  it.each(Object.keys(stacks).filter((s) => stacks[s].excluded))(
    'should not offer %s an excluded runner',
    async (stack) => {
      const { args, excluded } = stacks[stack];
      (clack.autocomplete as jest.Mock).mockImplementation(
        async ({ options }) => options[0].value
      );

      await determinePresetOptions({
        ...base,
        ...args,
        interactive: true,
      } as any);

      const question = (clack.autocomplete as jest.Mock).mock.calls
        .map(([q]) => q)
        .find((q) => String(q?.message ?? '').includes('unit test runner'));
      expect(question).toBeDefined();
      expect(
        question.options.map((o: { value: string }) => o.value)
      ).not.toContain(excluded);
    }
  );
});
