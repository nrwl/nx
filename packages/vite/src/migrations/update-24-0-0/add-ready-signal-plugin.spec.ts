import {
  addProjectConfiguration,
  stripIndents,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addReadySignalPlugin from './add-ready-signal-plugin';

describe('add-ready-signal-plugin migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function addApp(
    name: string,
    configFile: string,
    content: string,
    project: Partial<ProjectConfiguration> = {}
  ) {
    const root = `apps/${name}`;
    addProjectConfiguration(tree, name, {
      root,
      projectType: 'application',
      ...project,
    });
    tree.write(`${root}/${configFile}`, content);
    return `${root}/${configFile}`;
  }

  it('should add the plugin to a defineConfig object', async () => {
    const path = addApp(
      'demo',
      'vite.config.ts',
      stripIndents`
      /// <reference types='vitest' />
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';

      export default defineConfig({
        root: import.meta.dirname,
        plugins: [react()],
        server: { port: 4200 },
      });`
    );

    const result = await addReadySignalPlugin(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(path, 'utf-8')).toMatchInlineSnapshot(`
      "/// <reference types='vitest' />
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

      export default defineConfig({
        root: import.meta.dirname,
        plugins: [react(), nxReadySignal()],
        server: { port: 4200 },
      });
      "
    `);
  });

  it('should add the plugin to a bare default export', async () => {
    const path = addApp(
      'demo',
      'vite.config.ts',
      stripIndents`
      export default {
        plugins: [],
      };`
    );

    await addReadySignalPlugin(tree);

    expect(tree.read(path, 'utf-8')).toMatchInlineSnapshot(`
      "import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

      export default {
        plugins: [nxReadySignal()],
      };
      "
    `);
  });

  it('should add a plugins array when the config has none', async () => {
    const path = addApp(
      'demo',
      'vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';

      export default defineConfig({
        root: import.meta.dirname,
      });`
    );

    await addReadySignalPlugin(tree);

    expect(tree.read(path, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

      export default defineConfig({
        plugins: [nxReadySignal()],
        root: import.meta.dirname,
      });
      "
    `);
  });

  it('should edit a factory returning an object, which is what the generators emit', async () => {
    const path = addApp(
      'demo',
      'vite.config.mts',
      stripIndents`
      import { defineConfig } from 'vite';
      import vue from '@vitejs/plugin-vue';

      export default defineConfig(() => ({
        root: import.meta.dirname,
        plugins: [vue()],
      }));`
    );

    await addReadySignalPlugin(tree);

    expect(tree.read(path, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import vue from '@vitejs/plugin-vue';
      import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

      export default defineConfig(() => ({
        root: import.meta.dirname,
        plugins: [vue(), nxReadySignal()],
      }));
      "
    `);
  });

  it('should edit a factory with a block body and a single return', async () => {
    const path = addApp(
      'demo',
      'vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';

      export default defineConfig(({ mode }) => {
        const isDev = mode === 'development';
        return {
          plugins: [react()],
          define: { __DEV__: isDev },
        };
      });`
    );

    await addReadySignalPlugin(tree);

    expect(tree.read(path, 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

      export default defineConfig(({ mode }) => {
        const isDev = mode === 'development';
        return {
          plugins: [react(), nxReadySignal()],
          define: { __DEV__: isDev },
        };
      });
      "
    `);
  });

  it('should use require in a CommonJS config', async () => {
    const path = addApp(
      'demo',
      'vite.config.cjs',
      stripIndents`
      const { defineConfig } = require('vite');
      const react = require('@vitejs/plugin-react');

      module.exports = defineConfig({
        plugins: [react()],
      });`
    );

    await addReadySignalPlugin(tree);

    expect(tree.read(path, 'utf-8')).toMatchInlineSnapshot(`
      "const { defineConfig } = require('vite');
      const react = require('@vitejs/plugin-react');
      const { nxReadySignal } = require('@nx/vite/plugins/nx-ready-signal.plugin');

      module.exports = defineConfig({
        plugins: [react(), nxReadySignal()],
      });
      "
    `);
  });

  it('should parse a JavaScript config', async () => {
    const path = addApp(
      'demo',
      'vite.config.mjs',
      stripIndents`
      import { defineConfig } from 'vite';

      export default defineConfig({
        plugins: [],
      });`
    );

    await addReadySignalPlugin(tree);

    expect(tree.read(path, 'utf-8')).toContain(
      "import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';"
    );
    expect(tree.read(path, 'utf-8')).toContain('plugins: [nxReadySignal()]');
  });

  it('should leave a config that already loads the plugin alone', async () => {
    const content = stripIndents`
    import { defineConfig } from 'vite';
    import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

    export default defineConfig({
      plugins: [nxReadySignal()],
    });`;
    const path = addApp('demo', 'vite.config.ts', content);

    const result = await addReadySignalPlugin(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(path, 'utf-8')).toBe(content);
  });

  it('should skip library projects', async () => {
    const content = stripIndents`
    import { defineConfig } from 'vite';

    export default defineConfig({
      plugins: [],
    });`;
    const path = addApp('ui', 'vite.config.ts', content, {
      projectType: 'library',
    });

    const result = await addReadySignalPlugin(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(path, 'utf-8')).toBe(content);
  });

  it('should skip a library build without a projectType', async () => {
    const content = stripIndents`
    import { defineConfig } from 'vite';
    import dts from 'vite-plugin-dts';

    export default defineConfig(() => ({
      plugins: [dts()],
      build: {
        lib: { entry: 'src/index.ts', name: 'ui' },
      },
    }));`;
    const path = addApp('ui', 'vite.config.ts', content, {
      projectType: undefined,
    });

    const result = await addReadySignalPlugin(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(path, 'utf-8')).toBe(content);
  });

  it('should ignore vitest configs', async () => {
    const content = stripIndents`
    import { defineConfig } from 'vitest/config';

    export default defineConfig({
      plugins: [],
      test: { globals: true },
    });`;
    const path = addApp('demo', 'vitest.config.ts', content);

    const result = await addReadySignalPlugin(tree);

    expect(result).toEqual({ skipAgentic: true });
    expect(tree.read(path, 'utf-8')).toBe(content);
  });

  it('should return skipAgentic when there is nothing to do', async () => {
    addProjectConfiguration(tree, 'api', {
      root: 'apps/api',
      projectType: 'application',
    });

    expect(await addReadySignalPlugin(tree)).toEqual({ skipAgentic: true });
  });

  it.each([
    [
      'mergeConfig',
      stripIndents`
      import { defineConfig, mergeConfig } from 'vite';
      import { baseConfig } from '../../vite.base';

      export default mergeConfig(baseConfig, defineConfig({ plugins: [] }));`,
      'not a plain object literal',
    ],
    [
      'shared base config',
      stripIndents`
      import { appConfig } from '../../vite.shared';

      export default appConfig;`,
      'not a plain object literal',
    ],
    [
      'factory with several returns',
      stripIndents`
      import { defineConfig } from 'vite';

      export default defineConfig(({ command }) => {
        if (command === 'serve') return { plugins: [] };
        return { plugins: [], build: { minify: true } };
      });`,
      'not a plain object literal',
    ],
    [
      'plugins defined elsewhere',
      stripIndents`
      import { defineConfig } from 'vite';
      import { plugins } from '../../vite.plugins';

      export default defineConfig({ plugins });`,
      'not a plain array literal',
    ],
    [
      'conditional plugins',
      stripIndents`
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';

      export default defineConfig(({ mode }) => ({
        plugins: mode === 'test' ? [] : [react()],
      }));`,
      'not a plain array literal',
    ],
    [
      'spread plugins',
      stripIndents`
      import { defineConfig } from 'vite';
      import { sharedPlugins } from '../../vite.plugins';

      export default defineConfig({ plugins: [...sharedPlugins] });`,
      'spreads plugins from elsewhere',
    ],
    [
      'spread config without plugins',
      stripIndents`
      import { defineConfig } from 'vite';
      import { shared } from '../../vite.shared';

      export default defineConfig({ ...shared, root: import.meta.dirname });`,
      'spreads another config',
    ],
  ])(
    'should leave a %s config alone and list it for the agent',
    async (_, content, reason) => {
      const path = addApp('demo', 'vite.config.ts', content);

      const result = await addReadySignalPlugin(tree);

      expect(tree.read(path, 'utf-8')).toBe(content);
      expect(result.skipAgentic).toBeUndefined();
      expect(result.agentContext).toContainEqual(
        expect.stringContaining(`${path} (project demo): `)
      );
      expect(result.agentContext).toContainEqual(
        expect.stringContaining(reason)
      );
      expect(result.nextSteps).toEqual([expect.stringContaining(path)]);
    }
  );

  it('should list an unparseable config without throwing', async () => {
    const content = stripIndents`
    import { defineConfig } from 'vite';

    export default defineConfig({ plugins: [react(`;
    const path = addApp('demo', 'vite.config.ts', content);

    const result = await addReadySignalPlugin(tree);

    expect(tree.read(path, 'utf-8')).toBe(content);
    expect(result.agentContext).toContainEqual(
      expect.stringContaining(`${path} (project demo): it has syntax errors`)
    );
  });

  it('should edit the configs it can while listing the rest', async () => {
    const editable = addApp(
      'demo',
      'vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';

      export default defineConfig({ plugins: [] });`
    );
    const shared = addApp(
      'admin',
      'vite.config.ts',
      stripIndents`
      import { appConfig } from '../../vite.shared';

      export default appConfig;`
    );

    const result = await addReadySignalPlugin(tree);

    expect(tree.read(editable, 'utf-8')).toContain('nxReadySignal()');
    expect(result.agentContext).toContainEqual(expect.stringContaining(shared));
    expect(result.agentContext).not.toContainEqual(
      expect.stringContaining(editable)
    );
  });

  it('should be a no-op when run twice', async () => {
    const path = addApp(
      'demo',
      'vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';

      export default defineConfig({ plugins: [react()] });`
    );

    await addReadySignalPlugin(tree);
    const afterFirstRun = tree.read(path, 'utf-8');
    expect(afterFirstRun).toContain('nxReadySignal()');

    await addReadySignalPlugin(tree);

    expect(tree.read(path, 'utf-8')).toBe(afterFirstRun);
  });
});
