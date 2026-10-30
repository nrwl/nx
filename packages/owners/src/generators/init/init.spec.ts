import { readJson, readNxJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initGenerator } from './init';

const { mockGetVcsRemoteInfo, mockLoggerWarn } = vi.hoisted(() => ({
  mockGetVcsRemoteInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('@nx/devkit', async () => {
  const actual =
    await vi.importActual<typeof import('@nx/devkit')>('@nx/devkit');
  return {
    ...actual,
    logger: { ...actual.logger, warn: mockLoggerWarn },
  };
});

vi.mock('@nx/devkit/internal', async () => {
  const actual = await vi.importActual<typeof import('@nx/devkit/internal')>(
    '@nx/devkit/internal'
  );
  return {
    ...actual,
    getVcsRemoteInfo: mockGetVcsRemoteInfo,
  };
});

describe('initGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    mockGetVcsRemoteInfo.mockReturnValue(null);
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

  it('should not duplicate the plugin or the global sync generator when run twice', async () => {
    await initGenerator(tree);
    await initGenerator(tree);

    const nxJson = readNxJson(tree)!;
    expect(nxJson.plugins).toEqual(['@nx/owners']);
    expect(nxJson.sync?.globalGenerators).toEqual([
      '@nx/owners:sync-codeowners-file',
    ]);
  });

  it('should expand the owners: true shorthand into inferred defaults', async () => {
    tree.write('.github/some-file.md', '');
    writeJson(tree, 'nx.json', { owners: true });

    await initGenerator(tree);

    expect(readNxJson(tree)!.owners).toEqual({
      format: 'github',
      patterns: [],
    });
  });

  it('should set the outputPath to CODEOWNERS if the file exists, and no existing value is set', async () => {
    tree.write('CODEOWNERS', 'some-content');

    await initGenerator(tree);

    expect(readNxJson(tree)!.owners).toMatchObject({
      outputPath: 'CODEOWNERS',
    });
  });

  it('should add @nx/owners to devDependencies', async () => {
    await initGenerator(tree);

    expect(
      readJson(tree, 'package.json').devDependencies['@nx/owners']
    ).toBeDefined();
  });

  it('should not touch package.json when skipPackageJson is set', async () => {
    await initGenerator(tree, { skipPackageJson: true });

    expect(
      readJson(tree, 'package.json').devDependencies?.['@nx/owners']
    ).toBeUndefined();
  });

  it('should warn when the VCS provider cannot be inferred', async () => {
    await initGenerator(tree);

    expect(readNxJson(tree)!.owners).toEqual({ patterns: [] });
    expect(mockLoggerWarn).toHaveBeenCalledOnce();
  });

  describe('inferred defaults - GitHub', () => {
    it('should infer the github format when a .github folder exists', async () => {
      tree.write('.github/some-file.md', '');

      await initGenerator(tree);

      expect(readNxJson(tree)!.owners).toMatchInlineSnapshot(`
{
  "format": "github",
  "patterns": [],
}
`);
    });

    it('should infer the github format from a github.com remote', async () => {
      mockGetVcsRemoteInfo.mockReturnValue({
        domain: 'github.com',
        slug: 'user/repo',
      });

      await initGenerator(tree);

      expect(readNxJson(tree)!.owners).toMatchInlineSnapshot(`
{
  "format": "github",
  "patterns": [],
}
`);
    });
  });

  describe('inferred defaults - GitLab', () => {
    it('should infer the gitlab format when a .gitlab folder exists', async () => {
      tree.write('.gitlab/some-file.md', '');

      await initGenerator(tree);

      expect(readNxJson(tree)!.owners).toMatchInlineSnapshot(`
{
  "format": "gitlab",
  "patterns": [],
  "sections": [],
}
`);
    });

    it('should infer the gitlab format from a gitlab.com remote', async () => {
      mockGetVcsRemoteInfo.mockReturnValue({
        domain: 'gitlab.com',
        slug: 'user/repo',
      });

      await initGenerator(tree);

      expect(readNxJson(tree)!.owners).toMatchInlineSnapshot(`
{
  "format": "gitlab",
  "patterns": [],
  "sections": [],
}
`);
    });
  });

  describe('inferred defaults - Bitbucket', () => {
    it('should infer the bitbucket format when a .bitbucket folder exists', async () => {
      tree.write('.bitbucket/some-file.md', '');

      await initGenerator(tree);

      expect(readNxJson(tree)!.owners).toMatchInlineSnapshot(`
{
  "format": "bitbucket",
  "patterns": [],
}
`);
    });

    it('should infer the bitbucket format from a bitbucket.org remote', async () => {
      mockGetVcsRemoteInfo.mockReturnValue({
        domain: 'bitbucket.org',
        slug: 'user/repo',
      });

      await initGenerator(tree);

      expect(readNxJson(tree)!.owners).toMatchInlineSnapshot(`
{
  "format": "bitbucket",
  "patterns": [],
}
`);
    });
  });
});
