import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './migrate-plugin-v1-to-gradle';

describe('migrate-plugin-v1-to-gradle', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('settings.gradle', '');
  });

  function setPlugins(plugins: any[]) {
    const nxJson = readNxJson(tree);
    nxJson.plugins = plugins;
    updateNxJson(tree, nxJson);
  }

  it('should replace a string registration and apply the project graph Gradle plugin', async () => {
    setPlugins(['@nx/gradle/plugin-v1']);

    await update(tree);

    expect(readNxJson(tree).plugins).toEqual(['@nx/gradle']);
    expect(tree.read('build.gradle', 'utf-8')).toContain(
      'id "dev.nx.gradle.project-graph" version "0.1.25"'
    );
  });

  it('should map v1 options and keep scopes and order', async () => {
    setPlugins([
      '@nx/js',
      {
        plugin: '@nx/gradle/plugin-v1',
        include: ['apps/**'],
        options: {
          testTargetName: 'test',
          buildTargetName: 'build',
          classesTargetName: 'classes',
          ciTargetName: 'test-ci',
          includeSubprojectsTasks: true,
          compileJavaTargetName: 'compile',
        },
      },
    ]);

    await update(tree);

    expect(readNxJson(tree).plugins).toEqual([
      '@nx/js',
      {
        plugin: '@nx/gradle',
        include: ['apps/**'],
        options: {
          testTargetName: 'test',
          buildTargetName: 'build',
          classesTargetName: 'classes',
          ciTestTargetName: 'test-ci',
          compileJavaTargetName: 'compile',
        },
      },
    ]);
  });

  it('should keep an existing ciTestTargetName over ciTargetName', async () => {
    setPlugins([
      {
        plugin: '@nx/gradle/plugin-v1',
        options: { ciTargetName: 'old-ci', ciTestTargetName: 'new-ci' },
      },
    ]);

    await update(tree);

    expect(readNxJson(tree).plugins).toEqual([
      { plugin: '@nx/gradle', options: { ciTestTargetName: 'new-ci' } },
    ]);
  });

  it('should rewrite source references and report them', async () => {
    setPlugins(['@nx/gradle/plugin-v1']);
    tree.write(
      'tools/plugin.ts',
      `import { createNodes } from '@nx/gradle/plugin-v1';
export { createDependencies } from "@nx/gradle/plugin-v1";
const lazy = () => import('@nx/gradle/plugin-v1');
const other = '@nx/gradle/plugin-v12';
`
    );
    tree.write(
      'tools/plugin.js',
      `const { createNodes } = require(\`@nx/gradle/plugin-v1\`);\n`
    );

    const result = await update(tree);

    expect(tree.read('tools/plugin.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { createNodes } from '@nx/gradle';
      export { createDependencies } from '@nx/gradle';
      const lazy = () => import('@nx/gradle');
      const other = '@nx/gradle/plugin-v12';
      "
    `);
    expect(tree.read('tools/plugin.js', 'utf-8')).toContain(
      'require(`@nx/gradle`)'
    );
    expect(result).toEqual({
      nextSteps: [expect.stringContaining('tools/plugin.ts')],
      agentContext: [expect.stringContaining('tools/plugin.js')],
    });
  });

  it('should not touch a workspace without the v1 plugin', async () => {
    setPlugins([{ plugin: '@nx/gradle', options: { testTargetName: 'test' } }]);
    tree.write('build.gradle', 'plugins {\n}\n');
    const nxJsonBefore = tree.read('nx.json', 'utf-8');

    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toBe(nxJsonBefore);
    expect(tree.read('build.gradle', 'utf-8')).toBe('plugins {\n}\n');
    expect(result).toEqual({ skipAgentic: true });
  });

  it('should be idempotent', async () => {
    setPlugins([
      { plugin: '@nx/gradle/plugin-v1', options: { ciTargetName: 'ci' } },
    ]);
    tree.write('tools/plugin.ts', `import '@nx/gradle/plugin-v1';\n`);

    await update(tree);
    const nxJsonAfterFirst = tree.read('nx.json', 'utf-8');
    const buildGradleAfterFirst = tree.read('build.gradle', 'utf-8');
    const result = await update(tree);

    expect(tree.read('nx.json', 'utf-8')).toBe(nxJsonAfterFirst);
    expect(tree.read('build.gradle', 'utf-8')).toBe(buildGradleAfterFirst);
    expect(result).toEqual({ skipAgentic: true });
  });
});
