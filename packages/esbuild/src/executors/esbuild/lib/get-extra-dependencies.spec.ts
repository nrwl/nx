import { getExtraDependencies } from './get-extra-dependencies';

describe('getExtraDependencies', () => {
  it('should include npm dependencies of child libs', () => {
    const result = getExtraDependencies('parent', {
      nodes: {
        parent: {
          type: 'app',
          name: 'parent',
          data: {},
        },
        child1: {
          type: 'lib',
          name: 'child1',
          data: {},
        },
        child2: {
          type: 'lib',
          name: 'child2',
          data: {},
        },
      } as any,
      externalNodes: {
        'npm:react': {
          type: 'npm',
          name: 'npm:react',
          data: { packageName: 'react', version: '18.0.0' },
        },
        'npm:axios': {
          type: 'npm',
          name: 'npm:axios',
          data: { packageName: 'axios', version: '1.0.0' },
        },
        'npm:dayjs': {
          type: 'npm',
          name: 'npm:dayjs',
          data: { packageName: 'dayjs', version: '1.11.0' },
        },
      },
      dependencies: {
        parent: [
          { source: 'parent', target: 'child1', type: 'static' },
          { source: 'parent', target: 'npm:react', type: 'static' },
        ],
        child1: [
          { source: 'child1', target: 'child2', type: 'static' },
          { source: 'child1', target: 'npm:axios', type: 'static' },
        ],
        child2: [{ source: 'child2', target: 'npm:dayjs', type: 'static' }],
      },
    });

    expect(result).toEqual([
      {
        name: 'npm:react',
        outputs: [],
        node: {
          type: 'npm',
          name: 'npm:react',
          data: { packageName: 'react', version: '18.0.0' },
        },
      },
      {
        name: 'npm:axios',
        outputs: [],
        node: {
          type: 'npm',
          name: 'npm:axios',
          data: { packageName: 'axios', version: '1.0.0' },
        },
      },
      {
        name: 'npm:dayjs',
        outputs: [],
        node: {
          type: 'npm',
          name: 'npm:dayjs',
          data: { packageName: 'dayjs', version: '1.11.0' },
        },
      },
    ]);
  });

  it('should include npm dependencies of circular dependency child libs', () => {
    const result = getExtraDependencies('parent', {
      nodes: {
        parent: {
          type: 'app',
          name: 'parent',
          data: {},
        },
        child1: {
          type: 'lib',
          name: 'child1',
          data: {},
        },
        child2: {
          type: 'lib',
          name: 'child2',
          data: {},
        },
        child3: {
          type: 'lib',
          name: 'child3',
          data: {},
        },
        child4: {
          type: 'lib',
          name: 'child4',
          data: {},
        },
      } as any,
      externalNodes: {
        'npm:react': {
          type: 'npm',
          name: 'npm:react',
          data: { packageName: 'react', version: '18.0.0' },
        },
        'npm:axios': {
          type: 'npm',
          name: 'npm:axios',
          data: { packageName: 'axios', version: '1.0.0' },
        },
        'npm:dayjs': {
          type: 'npm',
          name: 'npm:dayjs',
          data: { packageName: 'dayjs', version: '1.11.0' },
        },
        'npm:date-fns': {
          type: 'npm',
          name: 'npm:date-fns',
          data: { packageName: 'date-fns', version: '2.0.0' },
        },
      },
      dependencies: {
        parent: [
          { source: 'parent', target: 'child1', type: 'static' },
          { source: 'parent', target: 'npm:react', type: 'static' },
        ],
        child1: [
          { source: 'child1', target: 'child2', type: 'static' },
          { source: 'child1', target: 'child3', type: 'static' },
          { source: 'child1', target: 'npm:axios', type: 'static' },
          { source: 'child1', target: 'child4', type: 'static' },
        ],
        child2: [
          { source: 'child2', target: 'npm:dayjs', type: 'static' },
          { source: 'child2', target: 'child3', type: 'static' },
        ],
        child3: [{ source: 'child3', target: 'child4', type: 'static' }],
        child4: [
          { source: 'child4', target: 'child3', type: 'static' },
          { source: 'child4', target: 'npm:date-fns', type: 'static' },
        ],
      },
    });

    expect(result).toEqual([
      {
        name: 'npm:react',
        outputs: [],
        node: {
          type: 'npm',
          name: 'npm:react',
          data: { packageName: 'react', version: '18.0.0' },
        },
      },
      {
        name: 'npm:axios',
        outputs: [],
        node: {
          type: 'npm',
          name: 'npm:axios',
          data: { packageName: 'axios', version: '1.0.0' },
        },
      },
      {
        name: 'npm:dayjs',
        outputs: [],
        node: {
          type: 'npm',
          name: 'npm:dayjs',
          data: { packageName: 'dayjs', version: '1.11.0' },
        },
      },
      {
        name: 'npm:date-fns',
        outputs: [],
        node: {
          type: 'npm',
          name: 'npm:date-fns',
          data: { packageName: 'date-fns', version: '2.0.0' },
        },
      },
    ]);
  });
});
