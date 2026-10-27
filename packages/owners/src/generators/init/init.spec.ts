import { readNxJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initGenerator } from './init';

// `vi.mock` factories are hoisted above every import, so the doubles they
// install have to be hoisted too.
const { mockExecSync, mockOutputWarn } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockOutputWarn: vi.fn(),
}));

vi.mock('@nx/devkit', async () => {
  const actual =
    await vi.importActual<typeof import('@nx/devkit')>('@nx/devkit');
  return {
    ...actual,
    output: {
      warn: mockOutputWarn,
    },
  };
});

vi.mock('node:child_process', async () => {
  const actualChildProcess =
    await vi.importActual<typeof import('node:child_process')>(
      'node:child_process'
    );
  return {
    ...actualChildProcess,
    execSync: mockExecSync,
  };
});

describe('initGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  afterEach(() => vi.clearAllMocks());

  it('should add the plugin', async () => {
    await initGenerator(tree);

    const nxJson = readNxJson(tree)!;
    expect(nxJson.plugins).toMatchInlineSnapshot(`
[
  "@nx/owners",
]
`);
  });

  it('should not add the plugin if it is already present in string form', async () => {
    writeJson(tree, 'nx.json', {
      plugins: ['@nx/owners'],
    });
    await initGenerator(tree);

    const nxJson = readNxJson(tree)!;
    expect(nxJson.plugins).toMatchInlineSnapshot(`
[
  "@nx/owners",
]
`);
  });

  it('should not add the plugin if it is already present in object form', async () => {
    writeJson(tree, 'nx.json', {
      plugins: [
        {
          plugin: '@nx/owners',
        },
      ],
    });
    await initGenerator(tree);

    const nxJson = readNxJson(tree)!;
    expect(nxJson.plugins).toMatchInlineSnapshot(`
[
  {
    "plugin": "@nx/owners",
  },
]
`);
  });

  it('should add the global sync generator to the nx.json file', async () => {
    await initGenerator(tree);

    const nxJson = readNxJson(tree)!;
    expect(nxJson.sync).toMatchInlineSnapshot(`
{
  "globalGenerators": [
    "@nx/owners:sync-codeowners-file",
  ],
}
`);
  });

  it('should set the outputPath to CODEOWNERS if the file exists, and no existing value is set', async () => {
    tree.write('CODEOWNERS', 'some-content');

    await initGenerator(tree);

    const nxJson = readNxJson(tree) as any;
    expect(nxJson.owners.outputPath).toBe('CODEOWNERS');
  });

  describe('inferred defaults - GitHub', () => {
    it('should add the owners key to the nx.json with inferred defaults when a .github folder exists', async () => {
      // Has a .github folder, default to github format
      tree.write('.github/some-file.md', '');

      await initGenerator(tree);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners).toMatchInlineSnapshot(`
{
  "format": "github",
  "patterns": [],
}
`);
    });

    it('should add the owners key to the nx.json with inferred defaults based on inspecting git remotes', async () => {
      mockExecSync.mockReturnValue(
        'origin git@github.com:user/repo.git (fetch)'
      );

      await initGenerator(tree);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners).toMatchInlineSnapshot(`
{
  "format": "github",
  "patterns": [],
}
`);
    });
  });

  describe('inferred defaults - GitLab', () => {
    it('should add the owners key to the nx.json with inferred defaults when a .gitlab folder exists', async () => {
      // Has a .gitlab folder, default to gitlab format
      tree.write('.gitlab/some-file.md', '');

      await initGenerator(tree);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners).toMatchInlineSnapshot(`
{
  "format": "gitlab",
  "patterns": [],
  "sections": [],
}
`);
    });

    it('should add the owners key to the nx.json with inferred defaults based on inspecting git remotes', async () => {
      mockExecSync.mockReturnValue(
        'origin git@gitlab.com:user/repo.git (fetch)'
      );

      await initGenerator(tree);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners).toMatchInlineSnapshot(`
{
  "format": "gitlab",
  "patterns": [],
  "sections": [],
}
`);
    });
  });

  describe('inferred defaults - Bitbucket', () => {
    it('should add the owners key to the nx.json with inferred defaults - Bitbucket', async () => {
      // Has a .bitbucket folder, default to bitbucket format
      tree.write('.bitbucket/some-file.md', '');

      await initGenerator(tree);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners).toMatchInlineSnapshot(`
{
  "format": "bitbucket",
  "patterns": [],
}
`);
    });

    it('should add the owners key to the nx.json with inferred defaults based on inspecting git remotes', async () => {
      mockExecSync.mockReturnValue(
        'origin git@bitbucket.org:user/repo.git (fetch)'
      );

      await initGenerator(tree);

      const nxJson = readNxJson(tree) as any;
      expect(nxJson.owners).toMatchInlineSnapshot(`
{
  "format": "bitbucket",
  "patterns": [],
}
`);
    });
  });
});
