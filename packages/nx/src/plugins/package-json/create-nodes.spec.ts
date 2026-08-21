import '../../internal-testing-utils/mock-fs';

import { join } from 'node:path';
import { vol } from 'memfs';
import { createNodeFromPackageJson, createNodes } from './create-nodes';
import { hashObject } from '../../hasher/file-hasher';
import { workspaceDataDirectory } from '../../utils/cache-directory';
import { PluginCache } from '../../utils/plugin-cache-utils';
import { nxVersion } from '../../utils/versions';

// plain require: the module replaces module.exports, so an `import * as`
// namespace would be a copy and spying on it would not affect the object
// create-nodes calls through
const packageJsonPluginModule = require('../../../plugins/package-json');

const packageJsonCachePath = join(workspaceDataDirectory, 'package-json.hash');

describe('nx package.json workspaces plugin', () => {
  const context = {
    workspaceRoot: '/root',
    nxJsonConfiguration: {},
  };

  const packageManagerCommand = {
    run: (script: string) => `npm run ${script}`,
  } as any;

  beforeEach(() => {
    // Ensure deterministic package manager detection: without a lockfile the
    // detector falls back to npm_config_user_agent, which makes test output
    // depend on whoever invoked jest (npm vs pnpm vs yarn).
    vol.fromJSON({ 'package-lock.json': '{}' }, '/root');
  });

  afterEach(() => {
    vol.reset();
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

    expect(
      createNodeFromPackageJson(
        'package.json',
        '/root',
        new PluginCache(packageJsonCachePath),
        false,
        packageManagerCommand
      )
    ).toMatchInlineSnapshot(`
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
    expect(
      createNodeFromPackageJson(
        'packages/lib-a/package.json',
        '/root',
        new PluginCache(packageJsonCachePath),
        false,
        packageManagerCommand
      )
    ).toMatchInlineSnapshot(`
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
    expect(
      createNodeFromPackageJson(
        'packages/lib-b/package.json',
        '/root',
        new PluginCache(packageJsonCachePath),
        false,
        packageManagerCommand
      )
    ).toMatchInlineSnapshot(`
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
      createNodeFromPackageJson(
        'apps/myapp/package.json',
        '/root',
        new PluginCache(packageJsonCachePath),
        false,
        packageManagerCommand
      ).projects['apps/myapp'].projectType
    ).toEqual('application');

    expect(
      createNodeFromPackageJson(
        'packages/mylib/package.json',
        '/root',
        new PluginCache(packageJsonCachePath),
        false,
        packageManagerCommand
      ).projects['packages/mylib'].projectType
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

    expect(
      createNodeFromPackageJson(
        'package.json',
        '/root',
        new PluginCache(packageJsonCachePath),
        false,
        packageManagerCommand
      ).projects['.'].projectType
    ).toEqual('library');
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
      createNodeFromPackageJson(
        'packages/mylib/package.json',
        '/root',
        new PluginCache(packageJsonCachePath),
        false,
        packageManagerCommand
      ).projects['packages/mylib'].projectType
    ).toEqual('library');
    expect(
      createNodeFromPackageJson(
        'example/package.json',
        '/root',
        new PluginCache(packageJsonCachePath),
        false,
        packageManagerCommand
      ).projects['example'].projectType
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

  describe('workspace alias validation', () => {
    it('should aggregate per-file errors for invalid workspace aliases and keep valid results', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/app/package.json': JSON.stringify({
            name: 'app',
            version: '1.0.0',
            dependencies: { 'alias-name': 'workspace:@acme/ghost@*' },
          }),
          'packages/lib-b/package.json': JSON.stringify({
            name: 'lib-b',
            version: '2.0.0',
          }),
        },
        '/root'
      );

      let error: any;
      try {
        await createNodes[1](
          ['packages/app/package.json', 'packages/lib-b/package.json'],
          undefined,
          context
        );
      } catch (e) {
        error = e;
      }

      expect(error.name).toEqual('AggregateCreateNodesError');
      expect(error.errors).toHaveLength(1);
      const [file, innerError] = error.errors[0];
      expect(file).toEqual('packages/app/package.json');
      expect(innerError.message).toContain(
        'Invalid workspace dependency alias "alias-name": "workspace:@acme/ghost@*".'
      );
      // valid files keep their results
      expect(
        error.partialResults.some(([f]) => f === 'packages/lib-b/package.json')
      ).toBe(true);
    });

    it('should validate the root manifest even when it is not an Nx project', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
            dependencies: { 'alias-name': 'workspace:ghost@*' },
          }),
          'packages/lib-b/package.json': JSON.stringify({
            name: 'lib-b',
            version: '2.0.0',
          }),
        },
        '/root'
      );

      await expect(
        createNodes[1](
          ['package.json', 'packages/lib-b/package.json'],
          undefined,
          context
        )
      ).rejects.toMatchObject({
        name: 'AggregateCreateNodesError',
        errors: [
          [
            'package.json',
            expect.objectContaining({
              message: expect.stringContaining(
                'Invalid workspace dependency alias'
              ),
            }),
          ],
        ],
      });
    });

    it('should not let a same-named package outside the package-manager workspaces satisfy an alias', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/app/package.json': JSON.stringify({
            name: 'app',
            version: '1.0.0',
            dependencies: { 'alias-name': 'workspace:fixture-lib@*' },
          }),
          'e2e/fixture/project.json': JSON.stringify({ name: 'fixture-lib' }),
          'e2e/fixture/package.json': JSON.stringify({
            name: 'fixture-lib',
            version: '1.0.0',
          }),
        },
        '/root'
      );

      await expect(
        createNodes[1](
          [
            'packages/app/package.json',
            'e2e/fixture/project.json',
            'e2e/fixture/package.json',
          ],
          undefined,
          context
        )
      ).rejects.toMatchObject({ name: 'AggregateCreateNodesError' });
    });

    it('should not validate manifests outside the package-manager workspaces', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'e2e/fixture/project.json': JSON.stringify({ name: 'fixture-lib' }),
          'e2e/fixture/package.json': JSON.stringify({
            name: 'fixture-lib',
            version: '1.0.0',
            dependencies: { 'alias-name': 'workspace:ghost@*' },
          }),
        },
        '/root'
      );

      const results = await createNodes[1](
        ['e2e/fixture/project.json', 'e2e/fixture/package.json'],
        undefined,
        context
      );
      expect(results.some(([f]) => f === 'e2e/fixture/package.json')).toBe(
        true
      );
    });

    it('should not report a missing target when a workspace manifest fails to parse', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/app/package.json': JSON.stringify({
            name: 'app',
            version: '1.0.0',
            dependencies: { 'alias-name': 'workspace:lib-b@*' },
          }),
          // the alias target's manifest is malformed, so target membership
          // cannot be determined
          'packages/lib-b/package.json': '{ invalid json',
        },
        '/root'
      );

      let error: any;
      try {
        await createNodes[1](
          ['packages/app/package.json', 'packages/lib-b/package.json'],
          undefined,
          context
        );
      } catch (e) {
        error = e;
      }

      // only the parse error surfaces; no missing-target report against app
      expect(error.name).toEqual('AggregateCreateNodesError');
      expect(error.errors).toHaveLength(1);
      expect(error.errors[0][0]).toEqual('packages/lib-b/package.json');
      expect(error.errors[0][1].message).not.toContain(
        'Invalid workspace dependency alias'
      );
    });

    it('should attribute a malformed root manifest to its file and keep valid results', async () => {
      vol.fromJSON(
        {
          'package.json': '{ invalid json',
          'packages/lib-b/package.json': JSON.stringify({
            name: 'lib-b',
            version: '2.0.0',
          }),
          'packages/lib-b/project.json': JSON.stringify({ name: 'lib-b' }),
        },
        '/root'
      );

      let error: any;
      try {
        await createNodes[1](
          [
            'package.json',
            'packages/lib-b/package.json',
            'packages/lib-b/project.json',
          ],
          undefined,
          context
        );
      } catch (e) {
        error = e;
      }

      expect(error.name).toEqual('AggregateCreateNodesError');
      expect(error.errors).toHaveLength(1);
      expect(error.errors[0][0]).toEqual('package.json');
      expect(
        error.partialResults.some(([f]) => f === 'packages/lib-b/package.json')
      ).toBe(true);
    });

    it('should accept aliases naming any workspace package, including the root package', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            version: '1.0.0',
            workspaces: ['packages/*'],
          }),
          'packages/app/package.json': JSON.stringify({
            name: 'app',
            version: '1.0.0',
            dependencies: {
              'alias-root': 'workspace:root@*',
              'alias-b': 'workspace:lib-b@^2.0.0',
            },
          }),
          'packages/lib-b/package.json': JSON.stringify({
            name: 'lib-b',
            version: '2.0.0',
          }),
        },
        '/root'
      );

      const results = await createNodes[1](
        [
          'package.json',
          'packages/app/package.json',
          'packages/lib-b/package.json',
        ],
        undefined,
        context
      );
      expect(results.some(([f]) => f === 'packages/app/package.json')).toBe(
        true
      );
    });
  });

  describe('workspace package dependency descriptors', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const getProject = (
      results: Awaited<ReturnType<(typeof createNodes)[1]>>,
      file: string
    ) => {
      const entry = results.find(([f]) => f === file);
      return Object.values(entry[1].projects)[0];
    };

    it('should collect dependencies resolving to workspace packages, including aliases', async () => {
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/app/package.json': JSON.stringify({
            name: 'app',
            version: '1.0.0',
            dependencies: {
              'lib-a': '^1.0.0',
              'alias-b': 'workspace:lib-b@*',
              'alias-c': 'npm:@scope/lib-c@^2.0.0',
              'external-pkg': '^5.0.0',
              'mismatched-alias': 'npm:lib-b@^9.0.0',
            },
            devDependencies: {
              'lib-b': 'workspace:*',
            },
          }),
          'packages/lib-a/package.json': JSON.stringify({
            name: 'lib-a',
            version: '1.2.3',
          }),
          'packages/lib-b/package.json': JSON.stringify({
            name: 'lib-b',
            version: '2.0.0',
          }),
          'packages/lib-c/package.json': JSON.stringify({
            name: '@scope/lib-c',
            version: '2.5.0',
          }),
        },
        '/root'
      );

      const results = await createNodes[1](
        [
          'packages/app/package.json',
          'packages/lib-a/package.json',
          'packages/lib-b/package.json',
          'packages/lib-c/package.json',
        ],
        undefined,
        context
      );

      const app = getProject(results, 'packages/app/package.json');
      expect(app.metadata.js.packageDependencies).toEqual({
        dependencies: {
          'lib-a': {
            rawSpecifier: '^1.0.0',
            requestedPackageName: 'lib-a',
          },
          'alias-b': {
            rawSpecifier: 'workspace:lib-b@*',
            requestedPackageName: 'lib-b',
          },
          'alias-c': {
            rawSpecifier: 'npm:@scope/lib-c@^2.0.0',
            requestedPackageName: '@scope/lib-c',
          },
        },
        devDependencies: {
          'lib-b': {
            rawSpecifier: 'workspace:*',
            requestedPackageName: 'lib-b',
          },
        },
      });

      // packages without workspace-target dependencies must not carry the field
      const libA = getProject(results, 'packages/lib-a/package.json');
      expect(libA.metadata.js.packageDependencies).toBeUndefined();
    });

    it('should recompute descriptors on cache hits and never store them in the cache', async () => {
      // plain and npm-alias entries degrade quietly when the target package
      // changes (a workspace: alias would instead raise a validation error)
      const appJson = {
        name: 'app',
        version: '1.0.0',
        dependencies: {
          'lib-b': '^2.0.0',
          'alias-b': 'npm:lib-b@^2.0.0',
        },
      };
      const files = {
        'package.json': JSON.stringify({
          name: 'root',
          workspaces: ['packages/*'],
        }),
        'packages/app/package.json': JSON.stringify(appJson),
        'packages/lib-b/package.json': JSON.stringify({
          name: 'lib-b',
          version: '2.0.0',
        }),
      };
      vol.fromJSON(files, '/root');

      // seed the cache instance the plugin will use with the app project, as
      // persisted by a previous run: keyed on the manifest's own content, no
      // descriptors, no targets (which a rebuild would compute)
      const hash = hashObject({
        ...appJson,
        root: 'packages/app',
        isInPackageManagerWorkspaces: true,
        nxVersion,
      });
      const cache = new PluginCache(packageJsonCachePath, {});
      cache.set(hash, {
        root: 'packages/app',
        name: 'app',
        metadata: {
          description: undefined,
          targetGroups: {},
          js: {
            packageName: 'app',
            packageVersion: '1.0.0',
            packageExports: undefined,
            packageMain: undefined,
            isInPackageManagerWorkspaces: true,
          },
        },
      });
      jest
        .spyOn(packageJsonPluginModule, 'readPackageJsonConfigurationCache')
        .mockReturnValue(cache);

      const configFiles = [
        'packages/app/package.json',
        'packages/lib-b/package.json',
      ];
      const firstRun = await createNodes[1](configFiles, undefined, context);
      const firstApp = getProject(firstRun, 'packages/app/package.json');
      // proves the cache hit was taken: a rebuild would have computed targets
      expect(firstApp.targets).toBeUndefined();
      expect(firstApp.metadata.js.packageDependencies).toEqual({
        dependencies: {
          'lib-b': {
            rawSpecifier: '^2.0.0',
            requestedPackageName: 'lib-b',
          },
          'alias-b': {
            rawSpecifier: 'npm:lib-b@^2.0.0',
            requestedPackageName: 'lib-b',
          },
        },
      });
      // the entry in the cache the plugin actually used must stay clean:
      // descriptors are attached to a clone, never baked into the cached entry
      expect(
        (cache.get(hash) as any).metadata.js.packageDependencies
      ).toBeUndefined();

      // The app project is served from the cache keyed on its own unchanged
      // content. Renaming the target package must still drop the stale
      // relationship on the next run.
      vol.fromJSON(
        {
          ...files,
          'packages/lib-b/package.json': JSON.stringify({
            name: 'lib-b-renamed',
            version: '2.0.0',
          }),
        },
        '/root'
      );

      const secondRun = await createNodes[1](configFiles, undefined, context);
      const secondApp = getProject(secondRun, 'packages/app/package.json');
      expect(secondApp.targets).toBeUndefined();
      expect(secondApp.metadata.js.packageDependencies).toBeUndefined();
    });

    it('should attach descriptors to projects served from the per-file cache', async () => {
      const appJson = {
        name: 'app',
        version: '1.0.0',
        dependencies: {
          'alias-b': 'workspace:lib-b@*',
        },
      };
      vol.fromJSON(
        {
          'package.json': JSON.stringify({
            name: 'root',
            workspaces: ['packages/*'],
          }),
          'packages/app/package.json': JSON.stringify(appJson),
          'packages/lib-b/package.json': JSON.stringify({
            name: 'lib-b',
            version: '2.0.0',
          }),
        },
        '/root'
      );

      // seed the on-disk cache with the app project, as persisted by a
      // previous run: keyed on the manifest's own content, no descriptors
      const hash = hashObject({
        ...appJson,
        root: 'packages/app',
        isInPackageManagerWorkspaces: true,
        nxVersion,
      });
      const cachedProject = {
        root: 'packages/app',
        name: 'app',
        metadata: {
          description: undefined,
          targetGroups: {},
          js: {
            packageName: 'app',
            packageVersion: '1.0.0',
            packageExports: undefined,
            packageMain: undefined,
            isInPackageManagerWorkspaces: true,
          },
        },
      };
      const seededCache = new PluginCache(packageJsonCachePath);
      seededCache.set(hash, cachedProject);
      seededCache.writeToDisk();

      const results = await createNodes[1](
        ['packages/app/package.json', 'packages/lib-b/package.json'],
        undefined,
        context
      );

      const app = getProject(results, 'packages/app/package.json');
      // proves the cache hit was taken: the seeded object's identity fields
      // survive (a rebuild would have computed targets, which we omitted)
      expect(app.targets).toBeUndefined();
      expect(app.metadata.js.packageDependencies).toEqual({
        dependencies: {
          'alias-b': {
            rawSpecifier: 'workspace:lib-b@*',
            requestedPackageName: 'lib-b',
          },
        },
      });
    });
  });
});
