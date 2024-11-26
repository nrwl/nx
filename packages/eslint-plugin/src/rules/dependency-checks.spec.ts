import 'nx/src/internal-testing-utils/mock-fs';

import dependencyChecks, {
  Options,
  RULE_NAME as dependencyChecksRuleName,
} from './dependency-checks';
import * as jsoncParser from 'jsonc-eslint-parser';
import { createProjectRootMappings } from 'nx/src/project-graph/utils/find-project-for-path';

import { vol } from 'memfs';
import {
  FileData,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '@nx/devkit';
import { Linter } from 'eslint';
import { FileDataDependency } from 'nx/src/config/project-graph';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

const rootPackageJson = {
  dependencies: {
    external1: '~16.1.2',
    external2: '^5.2.0',
  },
  devDependencies: {
    tslib: '^2.1.0',
  },
};

const externalNodes: Record<string, ProjectGraphExternalNode> = {
  'npm:external1': {
    name: 'npm:external1',
    type: 'npm',
    data: {
      packageName: 'external1',
      version: '16.1.8',
    },
  },
  'npm:external2': {
    name: 'npm:external2',
    type: 'npm',
    data: {
      packageName: 'external2',
      version: '5.5.6',
    },
  },
  'npm:random-external': {
    name: 'npm:random-external',
    type: 'npm',
    data: {
      packageName: 'random-external',
      version: '1.2.3',
    },
  },
  'npm:tslib': {
    name: 'npm:tslib',
    type: 'npm',
    data: {
      packageName: 'tslib',
      version: '2.1.0',
    },
  },
  'npm:@swc/helpers': {
    name: 'npm:@swc/helpers',
    type: 'npm',
    data: {
      packageName: '@swc/helpers',
      version: '1.2.3',
    },
  },
};

describe('Dependency checks (eslint)', () => {
  beforeEach(() => {
    globalThis.projPackageJsonDeps = undefined;
  });

  afterEach(() => {
    vol.reset();
  });

  it('should not error when everything is in order', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`, ['npm:external1']),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should exclude files not matching input of the build target', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {},
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './libs/liba/project.json': JSON.stringify(
        {
          name: 'liba',
          targets: {
            build: {
              command: 'tsc -p tsconfig.lib.json',
            },
          },
        },
        null,
        2
      ),
      './nx.json': JSON.stringify({
        targetDefaults: {
          build: {
            inputs: [
              '{projectRoot}/**/*',
              '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
            ],
          },
        },
      }),
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, []),
          createFile(`libs/liba/src/main.spec.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`, []),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should exclude files that are ignored', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {},
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/vite.config.ts': '',
      './libs/liba/project.json': JSON.stringify(
        {
          name: 'liba',
          targets: {
            build: {
              command: 'tsc -p tsconfig.lib.json',
            },
          },
        },
        null,
        2
      ),
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {
        ignoredFiles: ['{projectRoot}/vite.config.ts'],
      },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/vite.config.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`, []),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should report missing dependencies section and fix it', () => {
    const packageJson = {
      name: '@mycompany/liba',
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(`
      "Dependency sections are missing from the "package.json" but following dependencies were detected:
      - "external1""
    `);

    // apply fix
    const content = JSON.stringify(packageJson, null, 2);
    const result =
      content.slice(0, failures[0].fix.range[0]) +
      failures[0].fix.text +
      content.slice(failures[0].fix.range[1]);
    expect(result).toMatchInlineSnapshot(`
      "{
        "name": "@mycompany/liba",
        "dependencies": {
          "external1": "~16.1.2"
        }
      }"
    `);
  });

  it('should not report missing dependencies section if all dependencies are ignored', () => {
    const packageJson = {
      name: '@mycompany/liba',
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { ignoredDependencies: ['external1'] },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should not report missing dependencies section if no buildable target', () => {
    const packageJson = {
      name: '@mycompany/liba',
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { ignoredDependencies: ['external1'] },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                nonbuildable: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should not report missing dependencies section if no dependencies', () => {
    const packageJson = {
      name: '@mycompany/liba',
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { ignoredDependencies: ['external1'] },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {},
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`),
          createFile(`libs/liba/package.json`),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should error if package is missing and apply fixer', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, ['npm:external1']),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(`
      "The "liba" project uses the following packages, but they are missing from "dependencies":
          - external2"
    `);
    expect(failures[0].line).toEqual(3);

    // apply fix
    const content = JSON.stringify(packageJson, null, 2);
    const result =
      content.slice(0, failures[0].fix.range[0]) +
      failures[0].fix.text +
      content.slice(failures[0].fix.range[1]);
    expect(result).toMatchInlineSnapshot(`
      "{
        "name": "@mycompany/liba",
        "dependencies": {
          "external1": "^16.0.0",
          "external2": "^5.2.0"
        }
      }"
    `);
  });

  it('should add missing dependency when none are provided', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {},
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [createFile(`libs/liba/src/main.ts`, ['npm:external1'])],
      }
    );
    expect(failures.length).toEqual(1);

    // apply fix
    const content = JSON.stringify(packageJson, null, 2);
    const result =
      content.slice(0, failures[0].fix.range[0]) +
      failures[0].fix.text +
      content.slice(failures[0].fix.range[1]);
    expect(result).toMatchInlineSnapshot(`
      "{
        "name": "@mycompany/liba",
        "dependencies": {
          "external1": "~16.1.2"
        }
      }"
    `);
  });

  it('should take version from lockfile for fixer if not provided in the root package.json', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {},
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:random-external', type: 'static' },
          ],
        },
      },
      {
        liba: [createFile(`libs/liba/src/main.ts`, ['npm:random-external'])],
      }
    );
    expect(failures.length).toEqual(1);

    // apply fix
    const content = JSON.stringify(packageJson, null, 2);
    const result =
      content.slice(0, failures[0].fix.range[0]) +
      failures[0].fix.text +
      content.slice(failures[0].fix.range[1]);
    expect(result).toMatchInlineSnapshot(`
      "{
        "name": "@mycompany/liba",
        "dependencies": {
          "random-external": "1.2.3"
        }
      }"
    `);
  });

  it('should not error if there are no build targets', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { buildTargets: ['notbuild'] },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should not check missing deps if checkMissingDependencies=false', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { checkMissingDependencies: false },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should not report missing deps if in ignoredDependencies', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { ignoredDependencies: ['external2'] },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',

              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should error if package is obsolete and fix it', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
      peerDependencies: {
        unneeded: '>= 16 < 18',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:unneeded',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(
      `"The "unneeded" package is not used by "liba" project."`
    );
    expect(failures[0].line).toEqual(7);

    // should apply fixer
    const content = JSON.stringify(packageJson, null, 2);
    const result =
      content.slice(0, failures[0].fix.range[0]) +
      failures[0].fix.text +
      content.slice(failures[0].fix.range[1]);
    expect(result).toMatchInlineSnapshot(`
      "{
        "name": "@mycompany/liba",
        "dependencies": {
          "external1": "^16.0.0"
        },
        "peerDependencies": {}
      }"
    `);
  });

  it('should remove obsolete package in the middle with fix', () => {
    const packageJson = {
      name: '@mycompany/liba',
      peerDependencies: {
        external1: '^16.0.0',
        unneeded: '>= 16 < 18',
        external2: '^5.2.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
            'npm:unneeded',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(
      `"The "unneeded" package is not used by "liba" project."`
    );
    expect(failures[0].line).toEqual(5);

    // should apply fixer
    const content = JSON.stringify(packageJson, null, 2);
    const result =
      content.slice(0, failures[0].fix.range[0]) +
      failures[0].fix.text +
      content.slice(failures[0].fix.range[1]);
    expect(result).toMatchInlineSnapshot(`
      "{
        "name": "@mycompany/liba",
        "peerDependencies": {
          "external1": "^16.0.0",
          "external2": "^5.2.0"
        }
      }"
    `);
  });

  it('should remove obsolete package in the beginning with fix', () => {
    const packageJson = {
      name: '@mycompany/liba',
      peerDependencies: {
        unneeded: '>= 16 < 18',
        external1: '^16.0.0',
        external2: '^5.2.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
            'npm:unneeded',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(
      `"The "unneeded" package is not used by "liba" project."`
    );
    expect(failures[0].line).toEqual(4);

    // should apply fixer
    const content = JSON.stringify(packageJson, null, 2);
    const result =
      content.slice(0, failures[0].fix.range[0]) +
      failures[0].fix.text +
      content.slice(failures[0].fix.range[1]);
    expect(result).toMatchInlineSnapshot(`
      "{
        "name": "@mycompany/liba",
        "peerDependencies": {
          "external1": "^16.0.0",
          "external2": "^5.2.0"
        }
      }"
    `);
  });

  it('should remove obsolete package at the end with fix', () => {
    const packageJson = {
      name: '@mycompany/liba',
      peerDependencies: {
        external1: '^16.0.0',
        external2: '^5.2.0',
        unneeded: '>= 16 < 18',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
            'npm:unneeded',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(
      `"The "unneeded" package is not used by "liba" project."`
    );

    // should apply fixer
    const content = JSON.stringify(packageJson, null, 2);
    const result =
      content.slice(0, failures[0].fix.range[0]) +
      failures[0].fix.text +
      content.slice(failures[0].fix.range[1]);
    expect(result).toMatchInlineSnapshot(`
      "{
        "name": "@mycompany/liba",
        "peerDependencies": {
          "external1": "^16.0.0",
          "external2": "^5.2.0"
        }
      }"
    `);
  });

  it('should not check obsolete deps if checkObsoleteDependencies=false', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
      peerDependencies: {
        unneeded: '>= 16 < 18',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { checkObsoleteDependencies: false },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:unneeded',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should not report obsolete deps if in ignoredDependencies', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
      peerDependencies: {
        unneeded: '>= 16 < 18',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { ignoredDependencies: ['unneeded'] },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:unneeded',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should error if package version is mismatch and fix it', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '~16.0.0',
        external2: '^1.0.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(2);
    expect(failures[0].message).toMatchInlineSnapshot(
      `"The version specifier does not contain the installed version of "external1" package: 16.1.8."`
    );
    expect(failures[0].line).toEqual(4);
    expect(failures[1].message).toMatchInlineSnapshot(
      `"The version specifier does not contain the installed version of "external2" package: 5.5.6."`
    );
    expect(failures[1].line).toEqual(5);

    // should apply fixer
    const content = JSON.stringify(packageJson, null, 2);
    let result =
      content.slice(0, failures[0].fix.range[0]) +
      failures[0].fix.text +
      content.slice(failures[0].fix.range[1]);
    result =
      result.slice(0, failures[1].fix.range[0]) +
      failures[1].fix.text +
      result.slice(failures[1].fix.range[1]);
    expect(result).toMatchInlineSnapshot(`
      "{
        "name": "@mycompany/liba",
        "dependencies": {
          "external1": "~16.1.2",
          "external2": "^5.2.0"
        }
      }"
    `);
  });

  it('should not error if mismatch when checkVersionMismatches is false', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '~16.0.0',
        external2: '^1.0.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { checkVersionMismatches: false },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should not report mismatch if in ignoredDependencies', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '~16.0.0',
        external2: '^1.0.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { ignoredDependencies: ['external1'] },
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(
      `"The version specifier does not contain the installed version of "external2" package: 5.5.6."`
    );
    expect(failures[0].line).toEqual(5);
  });

  it('should require tslib if @nx/js:tsc executor', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
    };

    const tsConfigJson = {
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        module: 'commonjs',
        outDir: '../../dist/out-tsc',
        declaration: true,
        types: ['node'],
      },
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*_spec.ts',
        '**/*_test.ts',
        'jest.config.ts',
      ],
      include: ['**/*.ts'],
    };

    const tsConfigBaseJson = {
      compilerOptions: {
        target: 'es2015',
        importHelpers: true,
        module: 'commonjs',
        moduleResolution: 'node',
        outDir: 'build',
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        skipLibCheck: true,
        types: ['node'],
        lib: ['es2019'],
        declaration: true,
        resolveJsonModule: true,
        baseUrl: '.',
        rootDir: '.',
        allowJs: true,
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './libs/liba/tsconfig.json': JSON.stringify(tsConfigJson, null, 2),
      './package.json': JSON.stringify(rootPackageJson, null, 2),
      './tsconfig.base.json': JSON.stringify(tsConfigBaseJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {
                  executor: '@nx/js:tsc',
                  options: {
                    tsConfig: 'libs/liba/tsconfig.json',
                  },
                },
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`, ['npm:external1']),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(`
      "The "liba" project uses the following packages, but they are missing from "dependencies":
          - tslib"
    `);
    expect(failures[0].line).toEqual(3);
  });

  it('should report missing package if it is in devDependencies', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {},
      devDependencies: {
        external1: '^16.0.0',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(`
      "The "liba" project uses the following packages, but they are missing from "dependencies":
          - external1"
    `);
  });

  it('should not report * and workspace:*', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '*',
        external2: 'workspace:*',
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {},
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [
            { source: 'liba', target: 'npm:external1', type: 'static' },
            { source: 'liba', target: 'npm:external2', type: 'static' },
          ],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, [
            'npm:external1',
            'npm:external2',
          ]),
          createFile(`libs/liba/package.json`, [
            'npm:external1',
            'npm:external2',
          ]),
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should require swc if @nx/js:swc executor', () => {
    const packageJson = {
      name: '@mycompany/liba',
      dependencies: {
        external1: '^16.0.0',
      },
    };

    const swcrc = {
      jsc: {
        externalHelpers: true,
      },
    };

    const fileSys = {
      './libs/liba/package.json': JSON.stringify(packageJson, null, 2),
      './libs/liba/src/index.ts': '',
      './libs/liba/.swcrc': JSON.stringify(swcrc, null, 2),
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `/root/libs/liba/package.json`,
      JSON.stringify(packageJson, null, 2),
      {
        nodes: {
          liba: {
            name: 'liba',
            type: 'lib',
            data: {
              root: 'libs/liba',
              targets: {
                build: {
                  executor: '@nx/js:swc',
                  options: {},
                },
              },
            },
          },
        },
        externalNodes,
        dependencies: {
          liba: [{ source: 'liba', target: 'npm:external1', type: 'static' }],
        },
      },
      {
        liba: [
          createFile(`libs/liba/src/main.ts`, ['npm:external1']),
          createFile(`libs/liba/package.json`, ['npm:external1']),
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toMatchInlineSnapshot(`
    "The "liba" project uses the following packages, but they are missing from "dependencies":
        - @swc/helpers"
  `);
    expect(failures[0].line).toEqual(3);
  });
});

function createFile(f: string, deps?: FileDataDependency[]): FileData {
  return { file: f, hash: '', deps };
}

const linter = new Linter();
const baseConfig = {
  parser: 'jsonc-eslint-parser',
  rules: {
    [dependencyChecksRuleName]: 'error',
  },
};
linter.defineParser('jsonc-eslint-parser', jsoncParser as any);
linter.defineRule(dependencyChecksRuleName, dependencyChecks as any);

function runRule(
  ruleArguments: Options[0],
  filePath: string,
  content: string,
  projectGraph: ProjectGraph,
  projectFileMap: ProjectFileMap
): Linter.LintMessage[] {
  globalThis.projectGraph = projectGraph;
  globalThis.projectFileMap = projectFileMap;
  globalThis.projectRootMappings = createProjectRootMappings(
    projectGraph.nodes
  );

  const config = {
    ...baseConfig,
    rules: {
      [dependencyChecksRuleName]: ['error', ruleArguments],
    },
  };

  return linter.verify(content, config as any, filePath);
}
