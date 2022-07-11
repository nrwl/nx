import {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '@nrwl/devkit';
import {
  DepConstraint,
  findTransitiveExternalDependencies,
  hasBannedDependencies,
  hasBannedImport,
} from './runtime-lint-utils';

describe('hasBannedImport', () => {
  const source: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'aLib',
    data: {
      tags: ['a'],
    },
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

    expect(hasBannedImport(source, target, constraints)).toBe(constraints[1]);
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

    expect(hasBannedImport(source, target, constraints)).toBe(constraints[1]);
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

    expect(hasBannedImport(source, target, constraints)).toBe(undefined);
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

    expect(hasBannedImport(source, target, constraints)).toBe(undefined);
  });
});

describe('dependentsHaveBannedImport + findTransitiveExternalDependencies', () => {
  const source: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'aLib',
    data: {
      tags: ['a'],
    },
  };

  const target: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'bLib',
    data: {
      tags: ['b'],
    },
  };

  const c: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'cLib',
    data: {
      tags: ['c'],
    },
  };

  const d: ProjectGraphProjectNode = {
    type: 'lib',
    name: 'dLib',
    data: {
      tags: ['d'],
    },
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

  it('should return target and constraint pair if any dependents have banned import', () => {
    expect(
      hasBannedDependencies(externalDependencies.slice(1), graph, {
        sourceTag: 'a',
        bannedExternalImports: ['angular'],
      })
    ).toStrictEqual([]);
  });

  it('should return target and constraint pair if any dependents have banned import', () => {
    const constraint: DepConstraint = {
      sourceTag: 'a',
      bannedExternalImports: ['react-native'],
    };

    expect(
      hasBannedDependencies(externalDependencies.slice(1), graph, constraint)
    ).toStrictEqual([[bannedTarget, d, constraint]]);
  });

  it('should return multiple target and constraint pairs if any dependents have banned import', () => {
    const constraint: DepConstraint = {
      sourceTag: 'a',
      bannedExternalImports: ['react'],
    };

    expect(
      hasBannedDependencies(externalDependencies.slice(1), graph, constraint)
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
      hasBannedDependencies(externalDependencies.slice(1), graph, constraint)
        .length
    ).toBe(0);
  });
});
