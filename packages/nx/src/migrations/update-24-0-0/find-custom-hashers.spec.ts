import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import { writeJson } from '../../generators/utils/json';
import migration from './find-custom-hashers';

describe('find-custom-hashers migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function addLocalPlugin(
    root: string,
    executorsJson: object,
    field: 'executors' | 'builders' = 'executors'
  ) {
    writeJson(tree, `${root}/package.json`, {
      name: '@acme/my-plugin',
      [field]: `./${field}.json`,
    });
    writeJson(tree, `${root}/${field}.json`, executorsJson);
  }

  it('should skip the AI step when no package declares executors', async () => {
    writeJson(tree, 'libs/a/package.json', { name: '@acme/a' });
    const before = tree.read('libs/a/package.json', 'utf-8');

    const result = await migration(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read('libs/a/package.json', 'utf-8')).toBe(before);
  });

  it('should skip the AI step when no executor declares a hasher', async () => {
    addLocalPlugin('tools/my-plugin', {
      executors: {
        echo: {
          implementation: './src/executors/echo/executor',
          schema: './src/executors/echo/schema.json',
        },
        legacy: './src/executors/legacy/executor',
      },
    });

    const result = await migration(tree);

    expect(result).toEqual({ skipAgentic: true });
  });

  it('should report executors that declare a hasher without editing them', async () => {
    addLocalPlugin('tools/my-plugin', {
      executors: {
        echo: {
          implementation: './src/executors/echo/executor',
          hasher: './src/executors/echo/hasher',
          schema: './src/executors/echo/schema.json',
        },
        plain: {
          implementation: './src/executors/plain/executor',
          schema: './src/executors/plain/schema.json',
        },
      },
    });
    const before = tree.read('tools/my-plugin/executors.json', 'utf-8');

    const result = await migration(tree);

    expect(result.skipAgentic).toBeUndefined();
    expect(result.agentContext).toEqual([
      expect.stringContaining(
        'Executor "@acme/my-plugin:echo" declares a custom hasher at "tools/my-plugin/src/executors/echo/hasher" in "tools/my-plugin/executors.json".'
      ),
    ]);
    expect(result.nextSteps).toEqual([
      expect.stringContaining('Custom hashers are deprecated'),
      expect.stringContaining('@acme/my-plugin:echo'),
    ]);
    expect(result.agentContext.join('\n')).not.toContain('plain');
    expect(tree.read('tools/my-plugin/executors.json', 'utf-8')).toBe(before);
  });

  it.each([
    ['tools/my-plugin', './tools/my-plugin'],
    ['.', '.'],
  ])(
    'should name an executor in a nameless package at "%s" by its relative path',
    async (root, pluginName) => {
      writeJson(tree, `${root}/package.json`, {
        executors: './executors.json',
      });
      writeJson(tree, `${root}/executors.json`, {
        executors: {
          echo: {
            implementation: './echo',
            hasher: './hasher',
            schema: './schema.json',
          },
        },
      });

      const result = await migration(tree);

      expect(result.agentContext).toEqual([
        expect.stringContaining(`Executor "${pluginName}:echo"`),
      ]);
    }
  );

  it('should report hashers declared in a builders file', async () => {
    addLocalPlugin(
      'tools/my-plugin',
      {
        builders: {
          echo: {
            implementation: './src/executors/echo/executor',
            hasher: './src/executors/echo/hasher',
            schema: './src/executors/echo/schema.json',
          },
        },
      },
      'builders'
    );

    const result = await migration(tree);

    expect(result.skipAgentic).toBeUndefined();
    expect(result.agentContext).toEqual([
      expect.stringContaining(
        'Executor "@acme/my-plugin:echo" declares a custom hasher at "tools/my-plugin/src/executors/echo/hasher" in "tools/my-plugin/builders.json".'
      ),
    ]);
  });

  it('should report a hasher once when executors and builders share a file', async () => {
    writeJson(tree, 'tools/my-plugin/package.json', {
      name: '@acme/my-plugin',
      executors: './executors.json',
      builders: './executors.json',
    });
    writeJson(tree, 'tools/my-plugin/executors.json', {
      executors: {
        echo: {
          implementation: './echo',
          hasher: './hasher',
          schema: './schema.json',
        },
      },
    });

    const result = await migration(tree);

    expect(result.agentContext).toHaveLength(1);
  });

  it('should report executors and builders that share a name', async () => {
    addLocalPlugin('tools/my-plugin', {
      executors: {
        echo: {
          implementation: './echo',
          hasher: './hasher',
          schema: './s.json',
        },
      },
      builders: {
        echo: {
          implementation: './echo',
          hasher: './ng-hasher',
          schema: './s.json',
        },
      },
    });

    const result = await migration(tree);

    expect(result.agentContext).toEqual([
      expect.stringContaining('"tools/my-plugin/hasher"'),
      expect.stringContaining('"tools/my-plugin/ng-hasher"'),
    ]);
  });

  it('should ignore installed packages', async () => {
    addLocalPlugin('node_modules/@acme/my-plugin', {
      executors: {
        echo: {
          implementation: './echo',
          hasher: './hasher',
          schema: './schema.json',
        },
      },
    });

    const result = await migration(tree);

    expect(result).toEqual({ skipAgentic: true });
  });

  it('should skip and report an executors file it cannot parse', async () => {
    writeJson(tree, 'tools/my-plugin/package.json', {
      name: '@acme/my-plugin',
      executors: './executors.json',
    });
    tree.write('tools/my-plugin/executors.json', '{ "executors": { ');

    const result = await migration(tree);

    expect(result.skipAgentic).toBeUndefined();
    expect(result.agentContext).toEqual([
      expect.stringContaining(
        'Could not parse "tools/my-plugin/executors.json"'
      ),
    ]);
    expect(result.nextSteps).toEqual([
      expect.stringContaining('Custom hashers are deprecated'),
      expect.stringContaining('tools/my-plugin/executors.json'),
    ]);
  });

  it('should report malformed entries and keep scanning the valid ones', async () => {
    addLocalPlugin('tools/my-plugin', {
      executors: {
        broken: null,
        numeric: { implementation: './n', hasher: 42, schema: './s.json' },
        echo: {
          implementation: './echo',
          hasher: './hasher',
          schema: './s.json',
        },
      },
    });

    const result = await migration(tree);

    expect(result.skipAgentic).toBeUndefined();
    expect(result.agentContext).toEqual([
      expect.stringContaining('"@acme/my-plugin:echo"'),
      expect.stringContaining(
        'Entry "broken" in "tools/my-plugin/executors.json" is not a valid executor entry'
      ),
      expect.stringContaining(
        'Entry "numeric" in "tools/my-plugin/executors.json" is not a valid executor entry'
      ),
    ]);
    expect(result.nextSteps).toEqual(
      expect.arrayContaining([expect.stringContaining('Entry "broken"')])
    );
  });

  it('should report an executors map that is not an object', async () => {
    addLocalPlugin('tools/my-plugin', { executors: 'oops' });

    const result = await migration(tree);

    expect(result.agentContext).toEqual([
      expect.stringContaining(
        'Could not parse "tools/my-plugin/executors.json"'
      ),
    ]);
  });

  it('should skip and report a package.json declaring executors that it cannot parse', async () => {
    tree.write(
      'tools/my-plugin/package.json',
      '{ "name": "@acme/my-plugin", "executors": '
    );

    const result = await migration(tree);

    expect(result.skipAgentic).toBeUndefined();
    expect(result.agentContext).toEqual([
      expect.stringContaining('Could not parse "tools/my-plugin/package.json"'),
    ]);
  });
});
