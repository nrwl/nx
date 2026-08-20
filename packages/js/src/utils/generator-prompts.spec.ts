import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { selectPrompt } from '@nx/devkit/internal';
import { normalizeLinterOption } from './generator-prompts';

jest.mock('@nx/devkit/internal', () => ({
  ...jest.requireActual('@nx/devkit/internal'),
  selectPrompt: jest.fn(),
}));

const prompt = selectPrompt as jest.Mock;

describe('normalizeLinterOption', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    prompt.mockReset();
    // A value the workspace could not produce by detection, so a test that
    // passes only because the prompt ran is distinguishable from one that
    // passes because detection answered.
    prompt.mockResolvedValue('oxlint');
  });

  function addDevDependency(pkg: string) {
    const packageJson = JSON.parse(tree.read('package.json', 'utf-8'));
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      [pkg]: '1.0.0',
    };
    tree.write('package.json', JSON.stringify(packageJson));
  }

  it('should return an explicitly passed linter without detecting or asking', async () => {
    addDevDependency('oxlint');

    await expect(normalizeLinterOption(tree, 'eslint')).resolves.toBe('eslint');
    expect(prompt).not.toHaveBeenCalled();
  });

  it.each(['eslint', 'oxlint'] as const)(
    'should follow a workspace already using %s without asking',
    async (linter) => {
      addDevDependency(linter);

      await expect(normalizeLinterOption(tree, undefined)).resolves.toBe(
        linter
      );
      expect(prompt).not.toHaveBeenCalled();
    }
  );

  // Oxlint is the one being migrated *to*, and that precedence is settled, so
  // there is nothing to ask about.
  it('should take oxlint in a hybrid workspace without asking', async () => {
    addDevDependency('eslint');
    addDevDependency('oxlint');

    await expect(normalizeLinterOption(tree, undefined)).resolves.toBe(
      'oxlint'
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it('should detect through the inference plugin, not just dependencies', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [...(nxJson.plugins ?? []), '@nx/eslint/plugin'];
    updateNxJson(tree, nxJson);

    await expect(normalizeLinterOption(tree, undefined)).resolves.toBe(
      'eslint'
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it('should ask when the workspace has no linter to follow', async () => {
    await expect(normalizeLinterOption(tree, undefined)).resolves.toBe(
      'oxlint'
    );
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  // `none` is the non-interactive answer, and leads the list so the
  // interactive default matches it.
  it('should offer none first and fall back to it when the prompt cannot run', async () => {
    await normalizeLinterOption(tree, undefined);

    const [options] = prompt.mock.calls[0];
    expect(options.fallback).toBe('none');
    // The interactive default is the first choice, so it matches the fallback.
    expect(options.choices[0]).toEqual({ value: 'none' });
  });
});
