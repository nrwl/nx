import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-ready-signal-plugin';

const OBJECT_CONFIG = `import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/main.ts',
    },
  },
  server: {
    port: 4200,
  },
});
`;

const PLUGINS_CONFIG = `import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginSass(),
  ],
  server: {
    port: 4200,
  },
});
`;

describe('add-ready-signal-plugin migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function addApp(name: string, configFile: string, content: string) {
    addProjectConfiguration(tree, name, { root: `apps/${name}` });
    const configPath = `apps/${name}/${configFile}`;
    tree.write(configPath, content);
    return configPath;
  }

  it('should add the plugin to a config without a plugins option', async () => {
    const configPath = addApp('app1', 'rsbuild.config.ts', OBJECT_CONFIG);

    const result = await update(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "import { pluginNxReadySignal } from '@nx/rsbuild/ready-signal';
      import { defineConfig } from '@rsbuild/core';

      export default defineConfig({
        plugins: [pluginNxReadySignal()],

        source: {
          entry: {
            index: './src/main.ts',
          },
        },
        server: {
          port: 4200,
        },
      });
      "
    `);
  });

  it('should append the plugin to an existing plugins array', async () => {
    const configPath = addApp('app1', 'rsbuild.config.mjs', PLUGINS_CONFIG);

    const result = await update(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(configPath, 'utf-8')).toMatchInlineSnapshot(`
      "import { pluginNxReadySignal } from '@nx/rsbuild/ready-signal';
      import { defineConfig } from '@rsbuild/core';
      import { pluginReact } from '@rsbuild/plugin-react';
      import { pluginSass } from '@rsbuild/plugin-sass';

      export default defineConfig({
        plugins: [pluginReact(), pluginSass(), pluginNxReadySignal()],
        server: {
          port: 4200,
        },
      });
      "
    `);
  });

  it('should add the plugin to a config returned from an arrow function', async () => {
    const configPath = addApp(
      'app1',
      'rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';

export default defineConfig(({ envMode }) => ({
  plugins: [],
  server: { port: envMode === 'test' ? 4300 : 4200 },
}));
`
    );

    const result = await update(tree);

    expect(result).toEqual({ skipAgentic: true });
    const content = tree.read(configPath, 'utf-8');
    expect(content).toContain(
      "import { pluginNxReadySignal } from '@nx/rsbuild/ready-signal';"
    );
    expect(content).toContain('plugins: [pluginNxReadySignal()],');
  });

  it('should add the plugin to a config built in a function body with one return', async () => {
    const configPath = addApp(
      'app1',
      'rsbuild.config.ts',
      `import { defineConfig } from '@rsbuild/core';

export default defineConfig(({ envMode }) => {
  const port = envMode === 'test' ? 4300 : 4200;
  return { plugins: [], server: { port } };
});
`
    );

    const result = await update(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(configPath, 'utf-8')).toContain(
      'plugins: [pluginNxReadySignal()]'
    );
  });

  it('should leave a config that already loads the plugin unchanged', async () => {
    const content = `import { defineConfig } from '@rsbuild/core';
import { pluginNxReadySignal } from '@nx/rsbuild/ready-signal';

export default defineConfig({
  plugins: [pluginNxReadySignal()],
});
`;
    const configPath = addApp('app1', 'rsbuild.config.ts', content);

    const result = await update(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(configPath, 'utf-8')).toBe(content);
  });

  it('should be a no-op when run twice', async () => {
    const configPath = addApp('app1', 'rsbuild.config.ts', PLUGINS_CONFIG);

    await update(tree);
    const afterFirstRun = tree.read(configPath, 'utf-8');
    expect(afterFirstRun).toContain('pluginNxReadySignal()');

    const result = await update(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(configPath, 'utf-8')).toBe(afterFirstRun);
  });

  it('should ignore projects without an rsbuild config', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    tree.write('libs/lib1/vite.config.ts', `export default {};`);
    const projectJson = tree.read('libs/lib1/project.json', 'utf-8');

    const result = await update(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read('libs/lib1/project.json', 'utf-8')).toBe(projectJson);
    expect(tree.read('libs/lib1/vite.config.ts', 'utf-8')).toBe(
      `export default {};`
    );
  });

  describe('configs left for the prompt', () => {
    const shapes: Array<[string, string, string, string]> = [
      [
        'a config merged from a shared base',
        'rsbuild.config.ts',
        `import { defineConfig, mergeRsbuildConfig } from '@rsbuild/core';
import { baseConfig } from '../../rsbuild.base';

export default defineConfig(
  mergeRsbuildConfig(baseConfig, { plugins: [] })
);
`,
        'merges a shared base config',
      ],
      [
        'a plugins option that is not an array literal',
        'rsbuild.config.ts',
        `import { defineConfig } from '@rsbuild/core';
import { plugins } from './plugins';

export default defineConfig({
  plugins,
  server: { port: 4200 },
});
`,
        'plugins option is not a plain property assignment',
      ],
      [
        'a plugins array that spreads another list',
        'rsbuild.config.ts',
        `import { defineConfig } from '@rsbuild/core';
import { sharedPlugins } from './plugins';

export default defineConfig({
  plugins: [...sharedPlugins],
});
`,
        'plugins array spreads another list',
      ],
      [
        'a config that spreads a base config',
        'rsbuild.config.ts',
        `import { defineConfig } from '@rsbuild/core';
import { baseConfig } from '../../rsbuild.base';

export default defineConfig({
  ...baseConfig,
  server: { port: 4200 },
});
`,
        'spreads another config into defineConfig',
      ],
      [
        'a config factory with several returns',
        'rsbuild.config.ts',
        `import { defineConfig } from '@rsbuild/core';

export default defineConfig(({ envMode }) => {
  if (envMode === 'test') {
    return { plugins: [], server: { port: 4300 } };
  }
  return { plugins: [], server: { port: 4200 } };
});
`,
        'defineConfig is not called with an object literal',
      ],
      [
        'a config without defineConfig',
        'rsbuild.config.mjs',
        `export default {
  plugins: [],
  server: { port: 4200 },
};
`,
        'does not call defineConfig',
      ],
      [
        'a CommonJS config',
        'rsbuild.config.cjs',
        `const { defineConfig } = require('@rsbuild/core');

module.exports = defineConfig({
  plugins: [],
});
`,
        'CommonJS module',
      ],
      [
        'a config with syntax errors',
        'rsbuild.config.ts',
        `import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  plugins: [
`,
        'syntax errors',
      ],
    ];

    it.each(shapes)(
      'should list %s without editing it',
      async (_, configFile, content, reason) => {
        const configPath = addApp('app1', configFile, content);

        const result = await update(tree);

        expect(tree.read(configPath, 'utf-8')).toBe(content);
        expect(result.skipAgentic).toBeFalsy();
        expect(result.agentContext).toEqual([
          expect.stringContaining('Rsbuild configs left unchanged'),
          expect.stringContaining(`${configPath} (project app1): `),
        ]);
        expect(result.agentContext[1]).toContain(reason);
        expect(result.nextSteps).toEqual([expect.stringContaining(configPath)]);
      }
    );

    it('should still migrate the other configs', async () => {
      const editable = addApp('app1', 'rsbuild.config.ts', OBJECT_CONFIG);
      const skippedContent = `export default { plugins: [] };\n`;
      const skipped = addApp('app2', 'rsbuild.config.ts', skippedContent);

      const result = await update(tree);

      expect(tree.read(editable, 'utf-8')).toContain(
        `import { pluginNxReadySignal } from '@nx/rsbuild/ready-signal';`
      );
      expect(tree.read(skipped, 'utf-8')).toBe(skippedContent);
      expect(result.agentContext).toHaveLength(2);
      expect(result.agentContext[1]).toContain(skipped);
      expect(result.agentContext[1]).not.toContain(editable);
    });
  });
});
