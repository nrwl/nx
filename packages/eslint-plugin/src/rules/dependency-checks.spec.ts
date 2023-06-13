import 'nx/src/utils/testing/mock-fs';

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
  'npm:tslib': {
    name: 'npm:tslib',
    type: 'npm',
    data: {
      packageName: 'tslib',
      version: '2.1.0',
    },
  },
};

describe('Dependency checks (eslint)', () => {
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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

  it('should error if package is missing', () => {
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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
    expect(failures[0].message).toEqual(
      `The "external2" is missing from the "package.json".`
    );
    expect(failures[0].line).toEqual(3);
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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

  it('should error if package is obsolete', () => {
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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
    expect(failures[0].message).toEqual(
      `The "unneeded\" is found in the "package.json" but is not used.`
    );
    expect(failures[0].line).toEqual(7);
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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

  it('should error if package version is mismatch', () => {
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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
    expect(failures[0].message).toEqual(
      `The "external1" is found in the "package.json" but it's range is not matching the installed version. Installed version: 16.1.8.`
    );
    expect(failures[0].line).toEqual(4);
    expect(failures[1].message).toEqual(
      `The "external2" is found in the "package.json" but it's range is not matching the installed version. Installed version: 5.5.6.`
    );
    expect(failures[1].line).toEqual(5);
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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
      `${process.cwd()}/proj/libs/liba/package.json`,
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
    expect(failures[0].message).toEqual(
      `The "external2" is found in the "package.json" but it's range is not matching the installed version. Installed version: 5.5.6.`
    );
    expect(failures[0].line).toEqual(5);
  });

  it('should report missing package.json', () => {
    const projectJson = {
      name: 'liba',
      sourceRoot: 'libs/liba/src',
      projectType: 'library',
      targets: {
        build: {},
      },
    };

    const fileSys = {
      './libs/liba/project.json': JSON.stringify(projectJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/liba/project.json`,
      JSON.stringify(projectJson, null, 2),
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
        ],
      }
    );
    expect(failures.length).toEqual(1);
    expect(failures[0].message).toEqual(
      `The "package.json" is required for buildable libraries, but does not exist in "liba".`
    );
    expect(failures[0].line).toEqual(6);
  });

  it('should not report missing package.json if no buildable target', () => {
    const projectJson = {
      name: 'liba',
      sourceRoot: 'libs/liba/src',
      projectType: 'library',
      targets: {
        nonbuildable: {},
      },
    };

    const fileSys = {
      './libs/liba/project.json': JSON.stringify(projectJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/liba/project.json`,
      JSON.stringify(projectJson, null, 2),
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
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should not report missing package.json if checkMissingPackageJson=false', () => {
    const projectJson = {
      name: 'liba',
      sourceRoot: 'libs/liba/src',
      projectType: 'library',
      targets: {
        build: {},
      },
    };

    const fileSys = {
      './libs/liba/project.json': JSON.stringify(projectJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      { checkMissingPackageJson: false },
      `${process.cwd()}/proj/libs/liba/project.json`,
      JSON.stringify(projectJson, null, 2),
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
        ],
      }
    );
    expect(failures.length).toEqual(0);
  });

  it('should not report missing package.json if no dependencies', () => {
    const projectJson = {
      name: 'liba',
      sourceRoot: 'libs/liba/src',
      projectType: 'library',
      targets: {
        build: {},
      },
    };

    const fileSys = {
      './libs/liba/project.json': JSON.stringify(projectJson, null, 2),
      './libs/liba/src/index.ts': '',
      './package.json': JSON.stringify(rootPackageJson, null, 2),
    };
    vol.fromJSON(fileSys, '/root');

    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/liba/project.json`,
      JSON.stringify(projectJson, null, 2),
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
          liba: [],
        },
      },
      {
        liba: [createFile(`libs/liba/src/main.ts`)],
      }
    );
    expect(failures.length).toEqual(0);
  });
});

function createFile(f: string, deps?: (string | [string, string])[]): FileData {
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
  (global as any).projectPath = `${process.cwd()}/proj`;
  (global as any).projectGraph = projectGraph;
  (global as any).projectFileMap = projectFileMap;
  (global as any).projectRootMappings = createProjectRootMappings(
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
