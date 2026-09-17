import '../../internal-testing-utils/mock-fs';

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { vol } from 'memfs';
import {
  createNodeFromPackageJson,
  createNodes,
  createSharedPackageJsonInputs,
} from './create-nodes';
import { workspaceDataDirectory } from '../../utils/cache-directory';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import { getFileHashesInContext } from '../../utils/workspace-context';
import { hasNxJsPlugin } from '../../utils/has-nx-js-plugin';
import { PackageJsonConfigurationCache } from './cache';
import { PluginCache } from '../../utils/plugin-cache-utils';

vi.mock('../../utils/workspace-context', () => ({
  getFileHashesInContext: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../utils/has-nx-js-plugin', () => ({
  hasNxJsPlugin: vi.fn().mockReturnValue(true),
}));

const packageJsonCachePath = join(workspaceDataDirectory, 'package-json.hash');

describe('nx package.json workspaces plugin', () => {
  const context = {
    workspaceRoot: '/root',
    nxJsonConfiguration: {},
  };

  const packageManagerCommand = {
    run: (script: string) => `npm run ${script}`,
  } as any;

  const createNode = (packageJsonPath: string) =>
    createNodeFromPackageJson(
      packageJsonPath,
      '/root',
      new PackageJsonConfigurationCache(packageJsonCachePath),
      false,
      createSharedPackageJsonInputs(readNxJson('/root'), packageManagerCommand)
    );

  beforeEach(() => {
    // Ensure deterministic package manager detection: without a lockfile the
    // detector falls back to npm_config_user_agent, which makes test output
    // depend on whoever invoked the test runner (npm vs pnpm vs yarn).
    vol.fromJSON({ 'package-lock.json': '{}' }, '/root');
    vi.mocked(getFileHashesInContext).mockReset().mockResolvedValue([]);
    vi.mocked(hasNxJsPlugin).mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vol.reset();
  });

  it('hashes only eligible packages and preserves their input order', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({ workspaces: ['packages/a'] }),
        'packages/excluded/package.json': '{}',
        'packages/b/package.json': JSON.stringify({ name: 'b', private: true }),
        'packages/b/project.json': '{}',
        'packages/a/package.json': JSON.stringify({ name: 'a', private: true }),
      },
      '/root'
    );
    const results = await createNodes[1](
      [
        'packages/excluded/package.json',
        'packages/b/package.json',
        'packages/b/project.json',
        'packages/a/package.json',
      ],
      undefined,
      context
    );

    expect(getFileHashesInContext).toHaveBeenCalledExactlyOnceWith('/root', [
      'packages/b/package.json',
      'packages/b/project.json',
      'packages/a/package.json',
      'packages/a/project.json',
    ]);
    expect(results.map(([file]) => file)).toEqual([
      'packages/b/package.json',
      'packages/a/package.json',
    ]);
    expect(
      results[0][1].projects['packages/b'].metadata.js
        .isInPackageManagerWorkspaces
    ).toBe(false);
    expect(
      results[1][1].projects['packages/a'].metadata.js
        .isInPackageManagerWorkspaces
    ).toBe(true);
  });

  it('skips native hash lookup when there are no eligible packages', async () => {
    vol.fromJSON(
      {
        'package.json': '{}',
        'packages/excluded/package.json': '{}',
      },
      '/root'
    );

    expect(
      await createNodes[1](
        ['packages/excluded/package.json'],
        undefined,
        context
      )
    ).toEqual([]);
    expect(getFileHashesInContext).not.toHaveBeenCalled();
  });

  it('should build projects from package.json files', () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'root',
          scripts: { echo: 'echo root project' },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          description: 'lib-a description',
          scripts: { test: 'jest' },
        }),
        'packages/lib-b/package.json': JSON.stringify({
          name: 'lib-b',
          description: 'lib-b description',
          scripts: {
            build: 'tsc',
            test: 'jest',
            nonNxOperation: 'rm -rf .',
          },
          nx: {
            implicitDependencies: ['lib-a'],
            includedScripts: ['build', 'test'],
            targets: {
              build: {
                outputs: ['{projectRoot}/dist'],
              },
            },
          },
        }),
      },
      '/root'
    );

    expect(createNode('package.json')).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "metadata": {
              "description": undefined,
              "js": {
                "isInPackageManagerWorkspaces": false,
                "packageExports": undefined,
                "packageMain": undefined,
                "packageName": "root",
                "packageVersion": undefined,
              },
              "targetGroups": {
                "NPM Scripts": [
                  "echo",
                ],
              },
            },
            "name": "root",
            "root": ".",
            "tags": [
              "npm:public",
            ],
            "targets": {
              "echo": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run echo",
                  "scriptContent": "echo root project",
                },
                "options": {
                  "script": "echo",
                },
              },
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
            },
          },
        },
      }
    `);
    expect(createNode('packages/lib-a/package.json')).toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-a": {
            "metadata": {
              "description": "lib-a description",
              "js": {
                "isInPackageManagerWorkspaces": false,
                "packageExports": undefined,
                "packageMain": undefined,
                "packageName": "lib-a",
                "packageVersion": undefined,
              },
              "targetGroups": {
                "NPM Scripts": [
                  "test",
                ],
              },
            },
            "name": "lib-a",
            "root": "packages/lib-a",
            "tags": [
              "npm:public",
            ],
            "targets": {
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
              "test": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run test",
                  "scriptContent": "jest",
                },
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
    expect(createNode('packages/lib-b/package.json')).toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-b": {
            "implicitDependencies": [
              "lib-a",
            ],
            "includedScripts": [
              "build",
              "test",
            ],
            "metadata": {
              "description": "lib-b description",
              "js": {
                "isInPackageManagerWorkspaces": false,
                "packageExports": undefined,
                "packageMain": undefined,
                "packageName": "lib-b",
                "packageVersion": undefined,
              },
              "targetGroups": {
                "NPM Scripts": [
                  "build",
                  "test",
                ],
              },
            },
            "name": "lib-b",
            "root": "packages/lib-b",
            "tags": [
              "npm:public",
            ],
            "targets": {
              "build": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run build",
                  "scriptContent": "tsc",
                },
                "options": {
                  "script": "build",
                },
                "outputs": [
                  "{projectRoot}/dist",
                ],
              },
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
              "test": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run test",
                  "scriptContent": "jest",
                },
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
  });

  describe('persisted cache', () => {
    const getProject = (result, root = 'packages/a') =>
      result[0][1].projects[root];
    const runPlugin = async (
      nxJsonConfiguration: NxJsonConfiguration = {},
      configFiles = ['packages/a/package.json', 'packages/a/project.json']
    ) =>
      getProject(
        await createNodes[1](configFiles, undefined, {
          ...context,
          nxJsonConfiguration,
        })
      );

    it('reuses a project until its package.json hash changes', async () => {
      const writeCache = vi.spyOn(PluginCache.prototype, 'writeToDisk');
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'repo',
            workspaces: ['packages/*'],
          }),
          'packages/a/package.json': JSON.stringify({
            name: 'a',
            private: true,
            scripts: { test: 'old-command' },
          }),
        },
        '/root'
      );
      vi.mocked(getFileHashesInContext).mockResolvedValue(['package-v1', null]);

      const first = await runPlugin({}, ['packages/a/package.json']);
      expect(existsSync(packageJsonCachePath)).toBe(true);
      expect(first.targets.test.metadata.scriptContent).toBe('old-command');
      expect(writeCache).toHaveBeenCalledOnce();
      writeCache.mockClear();

      vol.writeFileSync(
        '/root/packages/a/package.json',
        JSON.stringify({
          name: 'a',
          private: true,
          scripts: { test: 'new-command' },
        })
      );
      const cached = await runPlugin({}, ['packages/a/package.json']);
      expect(cached.targets.test.metadata.scriptContent).toBe('old-command');
      expect(writeCache).not.toHaveBeenCalled();

      vi.mocked(getFileHashesInContext).mockResolvedValue(['package-v2', null]);
      const updated = await runPlugin({}, ['packages/a/package.json']);
      expect(updated.targets.test.metadata.scriptContent).toBe('new-command');
      expect(writeCache).toHaveBeenCalledOnce();
      const persistedCache = JSON.parse(
        vol.readFileSync(packageJsonCachePath, 'utf8').toString()
      );
      expect(Object.keys(persistedCache.entries)).toHaveLength(1);
    });

    it('invalidates a project when its sibling project.json changes', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'repo' }),
          'packages/a/package.json': JSON.stringify({
            name: 'a',
            private: true,
            scripts: { test: 'vitest' },
          }),
          'packages/a/project.json': JSON.stringify({ targets: {} }),
        },
        '/root'
      );
      vi.mocked(getFileHashesInContext).mockResolvedValue([
        'package-v1',
        'project-v1',
      ]);

      const first = await runPlugin();
      expect(first.targets.test).toBeDefined();

      vol.writeFileSync(
        '/root/packages/a/project.json',
        JSON.stringify({
          targets: { test: { executor: 'nx:noop' } },
        })
      );
      const cached = await runPlugin();
      expect(cached.targets.test).toBeDefined();

      vi.mocked(getFileHashesInContext).mockResolvedValue([
        'package-v1',
        'project-v2',
      ]);
      const updated = await runPlugin();
      expect(updated.targets.test).toBeUndefined();
    });

    it('invalidates a project when nx.json inputs change', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'repo' }),
          'packages/a/package.json': JSON.stringify({
            name: 'a',
          }),
          'packages/a/project.json': '{}',
        },
        '/root'
      );
      vi.mocked(getFileHashesInContext).mockResolvedValue([
        'package-v1',
        'project-v1',
      ]);

      const first = await runPlugin();
      expect(first.projectType).toBeUndefined();

      const updated = await runPlugin({
        workspaceLayout: { appsDir: 'apps', libsDir: 'packages' },
      });
      expect(updated.projectType).toBe('library');

      const updatedTargetDefaults = await runPlugin({
        workspaceLayout: { appsDir: 'apps', libsDir: 'packages' },
        targetDefaults: {
          'nx-release-publish': { dependsOn: ['build'] },
        },
      });
      expect(
        updatedTargetDefaults.targets['nx-release-publish'].dependsOn
      ).toEqual(['^nx-release-publish', 'build']);
    });

    it('invalidates a project when the package manager changes', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'repo' }),
          'packages/a/package.json': JSON.stringify({
            name: 'a',
            private: true,
            scripts: { test: 'vitest' },
          }),
          'packages/a/project.json': '{}',
        },
        '/root'
      );
      vi.mocked(getFileHashesInContext).mockResolvedValue([
        'package-v1',
        'project-v1',
      ]);

      const first = await runPlugin();
      expect(first.targets.test.metadata.runCommand).toBe('npm run test');

      vol.unlinkSync('/root/package-lock.json');
      vol.writeFileSync('/root/pnpm-lock.yaml', 'lockfileVersion: 9');
      const updated = await runPlugin();
      expect(updated.targets.test.metadata.runCommand).toBe('pnpm run test');
    });

    it('reads unindexed sibling files and invalidates after their creation, edits, and deletion', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'repo',
            workspaces: ['packages/*'],
          }),
          'packages/a/package.json': JSON.stringify({
            name: 'a',
            private: true,
            scripts: { test: 'vitest' },
          }),
        },
        '/root'
      );
      vi.mocked(getFileHashesInContext).mockResolvedValue(['package-v1', null]);
      const run = () => runPlugin({}, ['packages/a/package.json']);
      expect((await run()).targets.test).toBeDefined();
      vol.writeFileSync(
        '/root/packages/a/project.json',
        JSON.stringify({ targets: { test: { executor: 'nx:noop' } } })
      );
      expect((await run()).targets.test).toBeUndefined();
      expect((await run()).targets.test).toBeUndefined();
      vol.writeFileSync('/root/packages/a/project.json', '{}');
      expect((await run()).targets.test).toBeDefined();
      vol.unlinkSync('/root/packages/a/project.json');
      expect((await run()).targets.test).toBeDefined();
    });

    it('does not resolve @nx/js for private packages on cold or warm runs', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'repo' }),
          'packages/a/package.json': JSON.stringify({
            name: 'a',
            private: true,
          }),
          'packages/a/project.json': '{}',
        },
        '/root'
      );
      vi.mocked(getFileHashesInContext).mockResolvedValue([
        'package-v1',
        'project-v1',
      ]);
      await runPlugin();
      await runPlugin();
      expect(hasNxJsPlugin).not.toHaveBeenCalled();
    });

    it('retains cached results after unrelated target defaults change', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'repo' }),
          'packages/a/package.json': JSON.stringify({
            name: 'a',
            private: true,
          }),
          'packages/a/project.json': '{}',
        },
        '/root'
      );
      vi.mocked(getFileHashesInContext).mockResolvedValue([
        'package-v1',
        'project-v1',
      ]);
      await runPlugin();
      const before = vol.readFileSync(packageJsonCachePath, 'utf8');
      await runPlugin({ targetDefaults: { test: { cache: true } } });
      expect(vol.readFileSync(packageJsonCachePath, 'utf8')).toEqual(before);
      await runPlugin({
        targetDefaults: { 'nx-release-publish': { dependsOn: ['build'] } },
      });
      expect(vol.readFileSync(packageJsonCachePath, 'utf8')).toEqual(before);
    });

    it('does not resolve @nx/js when the package supplies a release target', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'repo' }),
          'packages/a/package.json': JSON.stringify({
            name: 'a',
            nx: { targets: { 'nx-release-publish': { executor: 'nx:noop' } } },
          }),
          'packages/a/project.json': '{}',
        },
        '/root'
      );
      vi.mocked(getFileHashesInContext).mockResolvedValue([
        'package-v1',
        'project-v1',
      ]);
      expect((await runPlugin()).targets['nx-release-publish'].executor).toBe(
        'nx:noop'
      );
      await runPlugin();
      expect(hasNxJsPlugin).not.toHaveBeenCalled();
    });

    it('does not substitute root @nx/js resolution for project resolution', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'repo' }),
          'packages/a/package.json': JSON.stringify({ name: 'a' }),
          'packages/a/project.json': '{}',
        },
        '/root'
      );
      vi.mocked(getFileHashesInContext).mockResolvedValue([
        'package-v1',
        'project-v1',
      ]);
      vi.mocked(hasNxJsPlugin).mockImplementation((root) => root === '/root');
      expect((await runPlugin()).targets['nx-release-publish']).toBeUndefined();
      expect((await runPlugin()).targets['nx-release-publish']).toBeUndefined();
      expect(hasNxJsPlugin).toHaveBeenCalledWith('packages/a', '/root');
    });

    it('invalidates a project when @nx/js availability changes', () => {
      vol.fromJSON(
        {
          'packages/a/package.json': JSON.stringify({ name: 'a' }),
        },
        '/root'
      );
      vi.mocked(hasNxJsPlugin).mockReturnValue(true);
      const sharedInputs = createSharedPackageJsonInputs(
        {},
        packageManagerCommand
      );

      const cache = new PackageJsonConfigurationCache(packageJsonCachePath);
      const first = createNodeFromPackageJson(
        'packages/a/package.json',
        '/root',
        cache,
        false,
        sharedInputs,
        {
          packageJsonHash: 'package-v1',
          siblingProjectJsonHash: null,
        }
      );
      expect(
        first.projects['packages/a'].targets['nx-release-publish']
      ).toBeDefined();
      cache.writeToDiskIfChanged();

      vi.mocked(hasNxJsPlugin).mockReturnValue(false);
      const updated = createNodeFromPackageJson(
        'packages/a/package.json',
        '/root',
        new PackageJsonConfigurationCache(packageJsonCachePath),
        false,
        sharedInputs,
        {
          packageJsonHash: 'package-v1',
          siblingProjectJsonHash: null,
        }
      );
      expect(
        updated.projects['packages/a'].targets['nx-release-publish']
      ).toBeUndefined();
    });
  });

  describe('negative patterns', () => {
    it('should work based on negative patterns defined in package.json workspaces', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: [
              'packages/*',
              // Multiple negative entries
              '!packages/fs',
              '!packages/orm-browser-example',
              '!packages/framework-examples',
            ],
          }),
          'packages/vite/package.json': JSON.stringify({ name: 'vite' }),
          'packages/fs/package.json': JSON.stringify({ name: 'fs' }),
          'packages/orm-browser-example/package.json': JSON.stringify({
            name: 'orm-browser-example',
          }),
          'packages/framework-examples/package.json': JSON.stringify({
            name: 'framework-examples',
          }),
        },
        '/root'
      );

      const context = {
        workspaceRoot: '/root',
        nxJsonConfiguration: {},
      };

      // No matching project based on the package.json "workspace" config
      expect(
        await createNodes[1](['package.json'], undefined, context)
      ).toMatchInlineSnapshot(`[]`);

      // Matching project based on the package.json "workspace" config
      expect(
        await createNodes[1](['packages/vite/package.json'], undefined, context)
      ).toMatchInlineSnapshot(`
        [
          [
            "packages/vite/package.json",
            {
              "projects": {
                "packages/vite": {
                  "metadata": {
                    "description": undefined,
                    "js": {
                      "isInPackageManagerWorkspaces": true,
                      "packageExports": undefined,
                      "packageMain": undefined,
                      "packageName": "vite",
                      "packageVersion": undefined,
                    },
                    "targetGroups": {},
                  },
                  "name": "vite",
                  "root": "packages/vite",
                  "tags": [
                    "npm:public",
                  ],
                  "targets": {
                    "nx-release-publish": {
                      "dependsOn": [
                        "^nx-release-publish",
                      ],
                      "executor": "@nx/js:release-publish",
                      "options": {},
                    },
                  },
                },
              },
            },
          ],
        ]
      `);

      // No matching project based on the package.json "workspace" config
      expect(
        await createNodes[1](['packages/fs/package.json'], undefined, context)
      ).toMatchInlineSnapshot(`[]`);

      // No matching project based on the package.json "workspace" config
      expect(
        await createNodes[1](
          ['packages/orm-browser-example/package.json'],
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`[]`);

      // No matching project based on the package.json "workspace" config
      expect(
        await createNodes[1](
          ['packages/framework-examples/package.json'],
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`[]`);
    });

    it('should work based on negative patterns defined in pnpm-workspace.yaml', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'root' }),
          // Multiple negative entries
          'pnpm-workspace.yaml': `packages:
- 'packages/*'
- '!packages/fs'
- '!packages/orm-browser-example'
- '!packages/framework-examples'
`,
          'packages/vite/package.json': JSON.stringify({ name: 'vite' }),
          'packages/fs/package.json': JSON.stringify({ name: 'fs' }),
          'packages/orm-browser-example/package.json': JSON.stringify({
            name: 'orm-browser-example',
          }),
          'packages/framework-examples/package.json': JSON.stringify({
            name: 'framework-examples',
          }),
        },
        '/root'
      );

      const context = {
        workspaceRoot: '/root',
        nxJsonConfiguration: {},
      };

      // No matching project based on the pnpm-workspace.yaml "packages" config
      expect(
        await createNodes[1](['package.json'], undefined, context)
      ).toMatchInlineSnapshot(`[]`);

      // Matching project based on the pnpm-workspace.yaml "packages" config
      expect(
        await createNodes[1](['packages/vite/package.json'], undefined, context)
      ).toMatchInlineSnapshot(`
        [
          [
            "packages/vite/package.json",
            {
              "projects": {
                "packages/vite": {
                  "metadata": {
                    "description": undefined,
                    "js": {
                      "isInPackageManagerWorkspaces": true,
                      "packageExports": undefined,
                      "packageMain": undefined,
                      "packageName": "vite",
                      "packageVersion": undefined,
                    },
                    "targetGroups": {},
                  },
                  "name": "vite",
                  "root": "packages/vite",
                  "tags": [
                    "npm:public",
                  ],
                  "targets": {
                    "nx-release-publish": {
                      "dependsOn": [
                        "^nx-release-publish",
                      ],
                      "executor": "@nx/js:release-publish",
                      "options": {},
                    },
                  },
                },
              },
            },
          ],
        ]
      `);

      // No matching project based on the pnpm-workspace.yaml "packages" config
      expect(
        await createNodes[1](['packages/fs/package.json'], undefined, context)
      ).toMatchInlineSnapshot(`[]`);

      // No matching project based on the pnpm-workspace.yaml "packages" config
      expect(
        await createNodes[1](
          ['packages/orm-browser-example/package.json'],
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`[]`);

      // No matching project based on the pnpm-workspace.yaml "packages" config
      expect(
        await createNodes[1](
          ['packages/framework-examples/package.json'],
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`[]`);
    });

    it('should work based on negative patterns defined in lerna.json', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({ name: 'root' }),
          'lerna.json': JSON.stringify({
            packages: [
              'packages/*',
              // Multiple negative entries
              '!packages/fs',
              '!packages/orm-browser-example',
              '!packages/framework-examples',
            ],
          }),
          'packages/vite/package.json': JSON.stringify({ name: 'vite' }),
          'packages/fs/package.json': JSON.stringify({ name: 'fs' }),
          'packages/orm-browser-example/package.json': JSON.stringify({
            name: 'orm-browser-example',
          }),
          'packages/framework-examples/package.json': JSON.stringify({
            name: 'framework-examples',
          }),
        },
        '/root'
      );

      // No matching project based on the lerna.json "packages" config
      expect(
        await createNodes[1](['package.json'], undefined, context)
      ).toMatchInlineSnapshot(`[]`);

      // Matching project based on the lerna.json "packages" config
      expect(
        await createNodes[1](['packages/vite/package.json'], undefined, context)
      ).toMatchInlineSnapshot(`
        [
          [
            "packages/vite/package.json",
            {
              "projects": {
                "packages/vite": {
                  "metadata": {
                    "description": undefined,
                    "js": {
                      "isInPackageManagerWorkspaces": true,
                      "packageExports": undefined,
                      "packageMain": undefined,
                      "packageName": "vite",
                      "packageVersion": undefined,
                    },
                    "targetGroups": {},
                  },
                  "name": "vite",
                  "root": "packages/vite",
                  "tags": [
                    "npm:public",
                  ],
                  "targets": {
                    "nx-release-publish": {
                      "dependsOn": [
                        "^nx-release-publish",
                      ],
                      "executor": "@nx/js:release-publish",
                      "options": {},
                    },
                  },
                },
              },
            },
          ],
        ]
      `);

      // No matching project based on the lerna.json "packages" config
      expect(
        await createNodes[1](['packages/fs/package.json'], undefined, context)
      ).toMatchInlineSnapshot(`[]`);

      // No matching project based on the lerna.json "packages" config
      expect(
        await createNodes[1](
          ['packages/orm-browser-example/package.json'],
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`[]`);

      // No matching project based on the lerna.json "packages" config
      expect(
        await createNodes[1](
          ['packages/framework-examples/package.json'],
          undefined,
          context
        )
      ).toMatchInlineSnapshot(`[]`);
    });
  });

  describe('sibling project.json files', () => {
    it('should add a script target if the sibling project.json file does not exist', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/a/package.json': JSON.stringify({
            name: 'root',
            scripts: {
              build: 'echo build',
            },
          }),
        },
        '/root'
      );

      expect(
        await createNodes[1](['packages/a/package.json'], undefined, context)
      ).toMatchInlineSnapshot(`
        [
          [
            "packages/a/package.json",
            {
              "projects": {
                "packages/a": {
                  "metadata": {
                    "description": undefined,
                    "js": {
                      "isInPackageManagerWorkspaces": true,
                      "packageExports": undefined,
                      "packageMain": undefined,
                      "packageName": "root",
                      "packageVersion": undefined,
                    },
                    "targetGroups": {
                      "NPM Scripts": [
                        "build",
                      ],
                    },
                  },
                  "name": "root",
                  "root": "packages/a",
                  "tags": [
                    "npm:public",
                  ],
                  "targets": {
                    "build": {
                      "executor": "nx:run-script",
                      "metadata": {
                        "runCommand": "npm run build",
                        "scriptContent": "echo build",
                      },
                      "options": {
                        "script": "build",
                      },
                    },
                    "nx-release-publish": {
                      "dependsOn": [
                        "^nx-release-publish",
                      ],
                      "executor": "@nx/js:release-publish",
                      "options": {},
                    },
                  },
                },
              },
            },
          ],
        ]
      `);
    });

    it('should add a script target if the sibling project.json exists but does not have a conflicting target', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/a/package.json': JSON.stringify({
            name: 'root',
            scripts: {
              build: 'echo build',
              test: 'echo test',
            },
          }),
          'packages/a/project.json': JSON.stringify({
            targets: {
              'something-other-than-build': {
                command: 'echo something-other-than-build',
              },
              test: {
                dependsOn: ['build-native'],
              },
            },
          }),
        },
        '/root'
      );

      expect(
        await createNodes[1](['packages/a/package.json'], undefined, context)
      ).toMatchInlineSnapshot(`
        [
          [
            "packages/a/package.json",
            {
              "projects": {
                "packages/a": {
                  "metadata": {
                    "description": undefined,
                    "js": {
                      "isInPackageManagerWorkspaces": true,
                      "packageExports": undefined,
                      "packageMain": undefined,
                      "packageName": "root",
                      "packageVersion": undefined,
                    },
                    "targetGroups": {
                      "NPM Scripts": [
                        "build",
                        "test",
                      ],
                    },
                  },
                  "name": "root",
                  "root": "packages/a",
                  "tags": [
                    "npm:public",
                  ],
                  "targets": {
                    "build": {
                      "executor": "nx:run-script",
                      "metadata": {
                        "runCommand": "npm run build",
                        "scriptContent": "echo build",
                      },
                      "options": {
                        "script": "build",
                      },
                    },
                    "nx-release-publish": {
                      "dependsOn": [
                        "^nx-release-publish",
                      ],
                      "executor": "@nx/js:release-publish",
                      "options": {},
                    },
                    "test": {
                      "executor": "nx:run-script",
                      "metadata": {
                        "runCommand": "npm run test",
                        "scriptContent": "echo test",
                      },
                      "options": {
                        "script": "test",
                      },
                    },
                  },
                },
              },
            },
          ],
        ]
      `);
    });

    it('should not add a script target if the sibling project.json exists and has a conflicting target', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/a/package.json': JSON.stringify({
            name: 'root',
            scripts: {
              build: 'echo "build from package.json"',
            },
          }),
          'packages/a/project.json': JSON.stringify({
            targets: {
              build: {
                command: 'echo "build from project.json"',
              },
            },
          }),
        },
        '/root'
      );

      expect(
        await createNodes[1](['packages/a/package.json'], undefined, context)
      ).toMatchInlineSnapshot(`
        [
          [
            "packages/a/package.json",
            {
              "projects": {
                "packages/a": {
                  "metadata": {
                    "description": undefined,
                    "js": {
                      "isInPackageManagerWorkspaces": true,
                      "packageExports": undefined,
                      "packageMain": undefined,
                      "packageName": "root",
                      "packageVersion": undefined,
                    },
                    "targetGroups": {},
                  },
                  "name": "root",
                  "root": "packages/a",
                  "tags": [
                    "npm:public",
                  ],
                  "targets": {
                    "nx-release-publish": {
                      "dependsOn": [
                        "^nx-release-publish",
                      ],
                      "executor": "@nx/js:release-publish",
                      "options": {},
                    },
                  },
                },
              },
            },
          ],
        ]
      `);
    });
  });

  it('should infer library and application project types from appsDir and libsDir', () => {
    vol.fromJSON(
      {
        'nx.json': JSON.stringify({
          workspaceLayout: {
            appsDir: 'apps',
            libsDir: 'packages',
          },
        }),
        'apps/myapp/package.json': JSON.stringify({
          name: 'myapp',
          scripts: { test: 'jest' },
        }),
        'packages/mylib/package.json': JSON.stringify({
          name: 'mylib',
          scripts: { test: 'jest' },
        }),
      },
      '/root'
    );

    expect(
      createNode('apps/myapp/package.json').projects['apps/myapp'].projectType
    ).toEqual('application');

    expect(
      createNode('packages/mylib/package.json').projects['packages/mylib']
        .projectType
    ).toEqual('library');
  });

  it('should infer library types for root library project if both appsDir and libsDir are set to empty string', () => {
    vol.fromJSON(
      {
        'nx.json': JSON.stringify({
          workspaceLayout: {
            appsDir: '',
            libsDir: '',
          },
        }),
        'package.json': JSON.stringify({
          name: 'mylib',
          scripts: { test: 'jest' },
        }),
      },
      '/root'
    );

    expect(createNode('package.json').projects['.'].projectType).toEqual(
      'library'
    );
  });

  it('should infer library project type if only libsDir is set', () => {
    vol.fromJSON(
      {
        'nx.json': JSON.stringify({
          workspaceLayout: {
            libsDir: 'packages',
          },
        }),
        'example/package.json': JSON.stringify({
          name: 'example',
          scripts: { test: 'jest' },
        }),
        'packages/mylib/package.json': JSON.stringify({
          name: 'mylib',
          scripts: { test: 'jest' },
        }),
      },
      '/root'
    );

    expect(
      createNode('packages/mylib/package.json').projects['packages/mylib']
        .projectType
    ).toEqual('library');
    expect(
      createNode('example/package.json').projects['example'].projectType
    ).toBeUndefined();
  });

  it('should store js package metadata', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'repo',
          workspaces: ['packages/*'],
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          description: 'lib-a description',
          scripts: { test: 'jest' },
          exports: {
            './package.json': './package.json',
            '.': './dist/index.js',
          },
        }),
        // not in package manager workspaces
        'libs/lib-b/package.json': JSON.stringify({
          name: 'lib-b',
          description: 'lib-b description',
          scripts: { test: 'jest' },
          exports: {
            './package.json': './package.json',
            '.': './dist/index.js',
          },
        }),
        // project.json so it's identified as a project
        'libs/lib-b/project.json': '{}',
      },
      '/root'
    );

    expect(
      await createNodes[1](
        [
          'package.json',
          'packages/lib-a/package.json',
          'libs/lib-b/package.json',
          'libs/lib-b/project.json',
        ],

        undefined,
        context
      )
    ).toMatchInlineSnapshot(`
      [
        [
          "packages/lib-a/package.json",
          {
            "projects": {
              "packages/lib-a": {
                "metadata": {
                  "description": "lib-a description",
                  "js": {
                    "isInPackageManagerWorkspaces": true,
                    "packageExports": {
                      ".": "./dist/index.js",
                      "./package.json": "./package.json",
                    },
                    "packageMain": undefined,
                    "packageName": "lib-a",
                    "packageVersion": undefined,
                  },
                  "targetGroups": {
                    "NPM Scripts": [
                      "test",
                    ],
                  },
                },
                "name": "lib-a",
                "root": "packages/lib-a",
                "tags": [
                  "npm:public",
                ],
                "targets": {
                  "nx-release-publish": {
                    "dependsOn": [
                      "^nx-release-publish",
                    ],
                    "executor": "@nx/js:release-publish",
                    "options": {},
                  },
                  "test": {
                    "executor": "nx:run-script",
                    "metadata": {
                      "runCommand": "npm run test",
                      "scriptContent": "jest",
                    },
                    "options": {
                      "script": "test",
                    },
                  },
                },
              },
            },
          },
        ],
        [
          "libs/lib-b/package.json",
          {
            "projects": {
              "libs/lib-b": {
                "metadata": {
                  "description": "lib-b description",
                  "js": {
                    "isInPackageManagerWorkspaces": false,
                    "packageExports": {
                      ".": "./dist/index.js",
                      "./package.json": "./package.json",
                    },
                    "packageMain": undefined,
                    "packageName": "lib-b",
                    "packageVersion": undefined,
                  },
                  "targetGroups": {
                    "NPM Scripts": [
                      "test",
                    ],
                  },
                },
                "name": "lib-b",
                "root": "libs/lib-b",
                "tags": [
                  "npm:public",
                ],
                "targets": {
                  "nx-release-publish": {
                    "dependsOn": [
                      "^nx-release-publish",
                    ],
                    "executor": "@nx/js:release-publish",
                    "options": {},
                  },
                  "test": {
                    "executor": "nx:run-script",
                    "metadata": {
                      "runCommand": "npm run test",
                      "scriptContent": "jest",
                    },
                    "options": {
                      "script": "test",
                    },
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });
});
