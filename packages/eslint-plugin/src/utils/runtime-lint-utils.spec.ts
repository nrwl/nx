import 'nx/src/utils/testing/mock-fs';

import {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '@nx/devkit';
import {
  DepConstraint,
  findConstraintsFor,
  findTransitiveExternalDependencies,
  hasBannedDependencies,
  hasBannedImport,
  hasNoneOfTheseTags,
  isAngularSecondaryEntrypoint,
  isTerminalRun,
} from './runtime-lint-utils';
import { vol } from 'memfs';

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('findConstraintsFor', () => {
  it('should find constraints matching tag', () => {
    const constriants: DepConstraint[] = [
      { sourceTag: 'a', onlyDependOnLibsWithTags: ['b'] },
      { sourceTag: 'b', onlyDependOnLibsWithTags: ['c'] },
      { sourceTag: 'c', onlyDependOnLibsWithTags: ['a'] },
    ];

    expect(
      findConstraintsFor(constriants, {
        type: 'lib',
        name: 'someLib',
        data: { root: '.', tags: ['b'] },
      })
    ).toEqual([{ sourceTag: 'b', onlyDependOnLibsWithTags: ['c'] }]);
  });

  it('should find constraints matching *', () => {
    const constriants: DepConstraint[] = [
      { sourceTag: 'a', onlyDependOnLibsWithTags: ['b'] },
      { sourceTag: 'b', onlyDependOnLibsWithTags: ['c'] },
      { sourceTag: '*', onlyDependOnLibsWithTags: ['a'] },
    ];

    expect(
      findConstraintsFor(constriants, {
        type: 'lib',
        name: 'someLib',
        data: { root: '.', tags: ['b'] },
      })
    ).toEqual([
      { sourceTag: 'b', onlyDependOnLibsWithTags: ['c'] },
      { sourceTag: '*', onlyDependOnLibsWithTags: ['a'] },
    ]);
  });

  it('should find constraints matching regex', () => {
    const constriants: DepConstraint[] = [
      { sourceTag: 'a', onlyDependOnLibsWithTags: ['a'] },
      { sourceTag: '/^b$/', onlyDependOnLibsWithTags: ['c'] },
      { sourceTag: '/a|b/', onlyDependOnLibsWithTags: ['c'] },
    ];
    expect(
      findConstraintsFor(constriants, {
        type: 'lib',
        name: 'someLib',
        data: { root: '.', tags: ['b'] },
      })
    ).toEqual([
      { sourceTag: '/^b$/', onlyDependOnLibsWithTags: ['c'] },
      { sourceTag: '/a|b/', onlyDependOnLibsWithTags: ['c'] },
    ]);
    expect(
      findConstraintsFor(constriants, {
        type: 'lib',
        name: 'someLib',
        data: { root: '.', tags: ['baz'] },
      })
    ).toEqual([{ sourceTag: '/a|b/', onlyDependOnLibsWithTags: ['c'] }]);
  });

  it('should find constraints matching glob', () => {
    const constriants: DepConstraint[] = [
      { sourceTag: 'a:*', onlyDependOnLibsWithTags: ['b:*'] },
      { sourceTag: 'b:*', onlyDependOnLibsWithTags: ['c:*'] },
      { sourceTag: 'c:*', onlyDependOnLibsWithTags: ['a:*'] },
    ];
    expect(
      findConstraintsFor(constriants, {
        type: 'lib',
        name: 'someLib',
        data: { root: '.', tags: ['a:a'] },
      })
    ).toEqual([{ sourceTag: 'a:*', onlyDependOnLibsWithTags: ['b:*'] }]);
    expect(
      findConstraintsFor(constriants, {
        type: 'lib',
        name: 'someLib',
        data: { root: '.', tags: ['a:abc'] },
      })
    ).toEqual([{ sourceTag: 'a:*', onlyDependOnLibsWithTags: ['b:*'] }]);
  });
});

describe('hasBannedImport', () => {
  const source: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'aLib',
    data: {
      tags: ['a'],
    } as any,
  };

  const target: ProjectGraphExternalNode = {
    type: 'npm',
    name: 'npm:react-native',
    data: {
      packageName: 'react-native',
      version: '0.0.1',
    },
  };

  it('should return DepConstraint banning given target', () => {
    const constraints: DepConstraint[] = [
      {
        sourceTag: 'a',
      },
      {
        sourceTag: 'a',
        bannedExternalImports: ['react-native'],
      },
      {
        sourceTag: 'b',
        bannedExternalImports: ['react-native'],
      },
    ];

    expect(hasBannedImport(source, target, constraints, 'react-native')).toBe(
      constraints[1]
    );
  });

  it('should return just first DepConstraint banning given target', () => {
    const constraints: DepConstraint[] = [
      {
        sourceTag: 'a',
      },
      {
        sourceTag: 'a',
        bannedExternalImports: ['react-native'],
      },
      {
        sourceTag: 'a',
        bannedExternalImports: ['react-native'],
      },
    ];

    expect(hasBannedImport(source, target, constraints, 'react-native')).toBe(
      constraints[1]
    );
  });

  it('should return null if tag does not match', () => {
    const constraints: DepConstraint[] = [
      {
        sourceTag: 'a',
      },
      {
        sourceTag: 'notA',
        bannedExternalImports: ['react-native'],
      },
      {
        sourceTag: 'b',
        bannedExternalImports: ['react-native'],
      },
    ];

    expect(hasBannedImport(source, target, constraints, 'react-native')).toBe(
      undefined
    );
  });

  it('should return null if packages does not match', () => {
    const constraints: DepConstraint[] = [
      {
        sourceTag: 'a',
      },
      {
        sourceTag: 'a',
        bannedExternalImports: ['react-native-with-suffix'],
      },
    ];

    expect(hasBannedImport(source, target, constraints, 'react-native')).toBe(
      undefined
    );
  });
});

describe('dependentsHaveBannedImport + findTransitiveExternalDependencies', () => {
  const source: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'aLib',
    data: {
      tags: ['a'],
    } as any,
  };

  const target: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'bLib',
    data: {
      tags: ['b'],
    } as any,
  };

  const c: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'cLib',
    data: {
      tags: ['c'],
    } as any,
  };

  const d: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'dLib',
    data: {
      tags: ['d'],
    } as any,
  };

  const bannedTarget: ProjectGraphExternalNode = {
    type: 'npm',
    name: 'npm:react-native',
    data: {
      packageName: 'react-native',
      version: '0.0.1',
    },
  };

  const nonBannedTarget: ProjectGraphExternalNode = {
    type: 'npm',
    name: 'npm:react',
    data: {
      packageName: 'react',
      version: '18.0.1',
    },
  };

  const nonBannedTarget2: ProjectGraphExternalNode = {
    type: 'npm',
    name: 'npm:react-native-with-suffix',
    data: {
      packageName: 'react-native-with-suffix',
      version: '18.0.1',
    },
  };

  const graph: ProjectGraph = {
    nodes: {
      aLib: source,
      bLib: target,
      cLib: c,
      dLib: d,
    },
    externalNodes: {
      'npm:react-native': bannedTarget,
      'npm:react': nonBannedTarget,
      'npm:react-native-with-suffix': nonBannedTarget2,
    },
    dependencies: {
      aLib: [
        { type: 'static', target: 'bLib', source: 'aLib' },
        { type: 'static', target: 'npm:react', source: 'aLib' },
      ],
      bLib: [
        {
          type: 'static',
          target: 'npm:react-native-with-suffix',
          source: 'bLib',
        },
        { type: 'static', target: 'npm:react', source: 'bLib' },
        { type: 'static', target: 'cLib', source: 'bLib' },
        { type: 'static', target: 'dLib', source: 'bLib' },
      ],
      cLib: [{ type: 'static', target: 'npm:react', source: 'cLib' }],
      dLib: [{ type: 'static', target: 'npm:react-native', source: 'dLib' }],
    },
  };

  const externalDependencies = [
    graph.dependencies.aLib[1],
    graph.dependencies.bLib[0],
    graph.dependencies.bLib[1],
    graph.dependencies.cLib[0],
    graph.dependencies.dLib[0],
  ];

  it('should findTransitiveExternalDependencies', () => {
    expect(findTransitiveExternalDependencies(graph, source)).toStrictEqual(
      externalDependencies
    );
  });

  it("should return empty array if any dependents don't have banned import", () => {
    expect(
      hasBannedDependencies(
        externalDependencies.slice(1),
        graph,
        {
          sourceTag: 'a',
          bannedExternalImports: ['angular'],
        },
        'react-native'
      )
    ).toStrictEqual([]);
  });

  it('should return target and constraint pair if any dependents have banned import', () => {
    const constraint: DepConstraint = {
      sourceTag: 'a',
      bannedExternalImports: ['react-native'],
    };

    expect(
      hasBannedDependencies(
        externalDependencies.slice(1),
        graph,
        constraint,
        'react-native'
      )
    ).toStrictEqual([[bannedTarget, d, constraint]]);
  });

  it('should return multiple target and constraint pairs if any dependents have banned import', () => {
    const constraint: DepConstraint = {
      sourceTag: 'a',
      bannedExternalImports: ['react'],
    };

    expect(
      hasBannedDependencies(
        externalDependencies.slice(1),
        graph,
        constraint,
        'react'
      )
    ).toStrictEqual([
      [nonBannedTarget, target, constraint],
      [nonBannedTarget, c, constraint],
    ]);
  });

  it('should return undefined if no baneed external imports found', () => {
    const constraint: DepConstraint = {
      sourceTag: 'a',
      bannedExternalImports: ['angular'],
    };

    expect(
      hasBannedDependencies(
        externalDependencies.slice(1),
        graph,
        constraint,
        'react-native'
      ).length
    ).toBe(0);
    expect(
      hasBannedDependencies(
        externalDependencies.slice(1),
        graph,
        constraint,
        'react'
      ).length
    ).toBe(0);
  });
});

describe('is terminal run', () => {
  const originalProcess = process;

  const mockProcessArgv = (argv: string[]) => {
    process = Object.assign({}, process, { argv });
  };

  afterEach(() => {
    process = originalProcess;
  });

  it('is a terminal run when the command is started from the nx executor on Mac', () => {
    // Mac: $run npx nx lint my-nx-project
    mockProcessArgv([
      '/Users/user/.nvm/versions/node/v16.13.0/bin/node',
      '/Users/user/my-repo/node_modules/nx/bin/run-executor.js',
      '{"targetDescription":{"project":"my-nx-project","target":"lint"}',
    ]);
    expect(isTerminalRun()).toBe(true);
  });

  it('is a terminal run when the command is started from the nx executor on Windows', () => {
    // Windows: $run npx nx lint my-nx-project
    mockProcessArgv([
      'C:\\Program Files\\nodejs\\node.exe',
      'C:\\dev\\my-repo\\node_modules\\nx\\bin\\run-executor.js',
      '{"targetDescription":{"project":"my-nx-project","target":"lint"}',
    ]);
    expect(isTerminalRun()).toBe(true);
  });

  it('is a terminal run when the command is started from the node module eslint on Mac', () => {
    // Mac: $run npx eslint my-file.ts
    mockProcessArgv([
      '/Users/user/.nvm/versions/node/v16.13.0/bin/node',
      '/Users/user/rabobank/my-repo/node_modules/.bin/eslint',
      'my-file.ts',
    ]);
    expect(isTerminalRun()).toBe(true);
  });

  it('is a terminal run when the command is started from the node module eslint on Windows', () => {
    // Windows: $run npx eslint my-file.ts
    mockProcessArgv([
      'C:\\Program Files\\nodejs\\node.exe',
      'C:\\dev\\my-repo\\node_modules\\nx\\bin\\eslint',
      'my-file.ts',
    ]);
    expect(isTerminalRun()).toBe(true);
  });

  it('is not a terminal run when the is started from the IDE', () => {
    // Visual Studio Code mac
    mockProcessArgv([
      '/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper',
      '/Users/user/.vscode/extensions/dbaeumer.vscode-eslint-2.2.6/server/out/eslintServer.js',
      '--node-ipc',
      '--clientProcessId=95193',
    ]);
    expect(isTerminalRun()).toBe(false);
  });
});

describe('isAngularSecondaryEntrypoint', () => {
  beforeEach(() => {
    const tsConfig = {
      compilerOptions: {
        baseUrl: '.',
        resolveJsonModule: true,
        paths: {
          '@project/standard': ['libs/standard/src/index.ts'],
          '@project/standard/secondary': [
            'libs/standard/secondary/src/index.ts',
          ],
          '@project/standard/tertiary': [
            'libs/standard/tertiary/src/public_api.ts',
          ],
          '@project/features': ['libs/features/src/index.ts'],
          '@project/features/*': ['libs/features/*/random/folder/api.ts'],
          '@project/buildable': ['libs/buildable/src/index.ts'],
        },
      },
    };
    const fsJson = {
      'tsconfig.base.json': JSON.stringify(tsConfig),
      'apps/app.ts': '',
      'libs/standard/package.json': '{ "version": "0.0.0" }',
      'libs/standard/secondary/ng-package.json': JSON.stringify({
        lib: { entryFile: 'src/index.ts' },
      }),
      'libs/standard/secondary/src/index.ts': 'const bla = "foo"',
      'libs/standard/tertiary/ng-package.json': JSON.stringify({
        lib: { entryFile: 'src/public_api.ts' },
      }),
      'libs/standard/tertiary/src/public_api.ts': 'const bla = "foo"',
      'libs/features/package.json': '{ "version": "0.0.0" }',
      'libs/features/secondary/ng-package.json': JSON.stringify({
        lib: { entryFile: 'random/folder/api.ts' },
      }),
      'libs/features/secondary/random/folder/api.ts': 'const bla = "foo"',
      'libs/buildable/ng-package.json': JSON.stringify({
        lib: { entryFile: 'src/index.ts' },
      }),
    };
    vol.fromJSON(fsJson, '/root');
  });

  it('should return true for secondary entrypoints', () => {
    expect(
      isAngularSecondaryEntrypoint(
        '@project/standard',
        'apps/app.ts',
        'libs/standard'
      )
    ).toBe(false);
    expect(
      isAngularSecondaryEntrypoint(
        '@project/standard/secondary',
        'apps/app.ts',
        'libs/standard'
      )
    ).toBe(true);
    expect(
      isAngularSecondaryEntrypoint(
        '@project/standard/tertiary',
        'apps/app.ts',
        'libs/standard'
      )
    ).toBe(true);
    expect(
      isAngularSecondaryEntrypoint(
        '@project/features',
        'apps/app.ts',
        'libs/features'
      )
    ).toBe(false);
    expect(
      isAngularSecondaryEntrypoint(
        '@project/features/secondary',
        'apps/app.ts',
        'libs/features'
      )
    ).toBe(true);
    expect(
      isAngularSecondaryEntrypoint(
        '@project/buildable',
        'apps/app.ts',
        'libs/buildable'
      )
    ).toBe(false);
  });
});

describe('hasNoneOfTheseTags', () => {
  const source: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'aLib',
    data: {
      tags: ['abc'],
    } as any,
  };

  it.each([
    [true, ['a']],
    [true, ['b']],
    [true, ['c']],
    [true, ['az*']],
    [true, ['/[A-Z]+/']],
    [false, ['ab*']],
    [false, ['*']],
    [false, ['/[a-z]*/']],
  ])(
    'should return %s when project has tags ["abc"] and requested tags are %s',
    (expected, tags) => {
      expect(hasNoneOfTheseTags(source, tags)).toBe(expected);
    }
  );
});
