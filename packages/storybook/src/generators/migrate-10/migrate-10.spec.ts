import { existsSync } from 'fs';
import { installPackagesTask, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { callUpgrade, checkStorybookInstalled } from './calling-storybook-cli';
import migrate10Generator from './migrate-10';

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  installPackagesTask: vi.fn(),
  formatFiles: vi.fn(() => Promise.resolve()),
}));

vi.mock('./calling-storybook-cli', () => ({
  callUpgrade: vi.fn(),
  checkStorybookInstalled: vi.fn(),
}));

vi.mock('../../utils/assert-supported-storybook-version', () => ({
  assertSupportedStorybookVersion: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(),
}));

describe('migrate10Generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.mocked(installPackagesTask).mockClear();
    vi.mocked(callUpgrade).mockClear();
    vi.mocked(checkStorybookInstalled).mockReturnValue(true);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(callUpgrade).mockReturnValue({
      success: true,
      nxVersionsRestored: true,
    });
  });

  describe.each([
    ['the AI instructions are written', {}, true],
    ['the AI instructions are skipped', { skipAiInstructions: true }, true],
    ['the AI instructions file is missing', {}, false],
  ])('when %s', (_, schema, instructionsFileExists) => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(instructionsFileExists);
    });

    it('should return a callback that reinstalls packages when the Nx versions were restored', async () => {
      const callback = await migrate10Generator(tree, {
        autoAcceptAllPrompts: true,
        ...schema,
      });

      expect(installPackagesTask).not.toHaveBeenCalled();
      expect(callback).toEqual(expect.any(Function));

      (callback as () => void)();

      expect(installPackagesTask).toHaveBeenCalledWith(tree, true);
    });

    it('should return a callback when the upgrade failed after the Nx versions were restored', async () => {
      vi.mocked(callUpgrade).mockReturnValue({
        success: false,
        nxVersionsRestored: true,
      });

      const callback = await migrate10Generator(tree, {
        autoAcceptAllPrompts: true,
        ...schema,
      });

      expect(callback).toEqual(expect.any(Function));
    });

    it('should not return a callback when the Nx versions were not restored', async () => {
      vi.mocked(callUpgrade).mockReturnValue({
        success: true,
        nxVersionsRestored: false,
      });

      const callback = await migrate10Generator(tree, {
        autoAcceptAllPrompts: true,
        ...schema,
      });

      expect(callback).toBeUndefined();
    });
  });

  it('should not upgrade or return a callback when Storybook is not installed', async () => {
    vi.mocked(checkStorybookInstalled).mockReturnValue(false);

    const callback = await migrate10Generator(tree, {
      autoAcceptAllPrompts: true,
    });

    expect(callUpgrade).not.toHaveBeenCalled();
    expect(callback).toBeUndefined();
  });
});
