import { transformProjectGraphForRust } from '../transform-objects';
import { ProjectGraph } from '../../config/project-graph';

/**
 * `transformProjectGraphForRust` feeds the Rust hasher. Any difference in the
 * shape it returns — including key insertion order inside JSON-stringified
 * fields — produces a different ProjectConfiguration hash, which causes
 * spurious cache misses across CI runs that built the same logical graph in
 * different key orders (e.g. plugins iterating Map vs. Object, or async
 * resolution races).
 *
 * These tests assert that the transform is invariant to key insertion order
 * for every field that ends up in the hash input.
 */
describe('transformProjectGraphForRust', () => {
  function reverseKeys<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map(reverseKeys) as unknown as T;
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(value).reverse()) {
        out[key] = reverseKeys((value as Record<string, unknown>)[key]);
      }
      return out as unknown as T;
    }
    return value;
  }

  function makeGraph(transform: <T>(v: T) => T = (v) => v): ProjectGraph {
    const inputs = [
      'default',
      { runtime: 'node -v' },
      { env: 'CI' },
      { externalDependencies: ['typescript', 'react'] },
    ];
    const outputs = ['{workspaceRoot}/dist', '{projectRoot}/coverage'];
    const options = {
      foo: 1,
      bar: 2,
      baz: { x: 1, y: 2, z: 3 },
    };
    const configurations = {
      development: { mode: 'dev', flag: true },
      production: { mode: 'prod', flag: false },
    };
    const namedInputs = {
      default: ['{projectRoot}/**/*'],
      production: [
        'default',
        '!{projectRoot}/**/*.spec.ts',
        { externalDependencies: ['react', 'typescript'] },
      ],
    };

    return {
      nodes: {
        foo: {
          name: 'foo',
          type: 'lib',
          data: {
            root: 'libs/foo',
            namedInputs: transform(namedInputs),
            tags: ['scope:shared'],
            targets: {
              build: {
                executor: 'nx:run-commands',
                inputs: transform(inputs),
                outputs: transform(outputs),
                options: transform(options),
                configurations: transform(configurations),
                parallelism: false,
              },
            },
          },
        },
      },
      dependencies: { foo: [] },
      externalNodes: {},
    } as unknown as ProjectGraph;
  }

  it('produces an identical Rust input for two graphs that only differ in key insertion order', () => {
    const a = transformProjectGraphForRust(makeGraph());
    const b = transformProjectGraphForRust(makeGraph(reverseKeys));

    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
  });

  it('normalises target.options key order (covers the original PR case)', () => {
    const fwd = transformProjectGraphForRust(makeGraph());
    const rev = transformProjectGraphForRust(makeGraph(reverseKeys));

    expect(rev.nodes.foo.targets.build.options).toEqual(
      fwd.nodes.foo.targets.build.options
    );
  });

  it('normalises target.inputs / outputs (objects inside the array)', () => {
    const fwd = transformProjectGraphForRust(makeGraph());
    const rev = transformProjectGraphForRust(makeGraph(reverseKeys));

    expect(rev.nodes.foo.targets.build.inputs).toEqual(
      fwd.nodes.foo.targets.build.inputs
    );
    expect(rev.nodes.foo.targets.build.outputs).toEqual(
      fwd.nodes.foo.targets.build.outputs
    );
  });

  it('normalises namedInputs (top-level keys + nested objects)', () => {
    const fwd = transformProjectGraphForRust(makeGraph());
    const rev = transformProjectGraphForRust(makeGraph(reverseKeys));

    expect(rev.nodes.foo.namedInputs).toEqual(fwd.nodes.foo.namedInputs);
  });
});
