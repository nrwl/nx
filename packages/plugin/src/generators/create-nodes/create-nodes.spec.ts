import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { pluginGenerator } from '../plugin/plugin';
import { createNodesGenerator } from './create-nodes';
import { setCwd } from '@nx/devkit/internal-testing-utils';

describe('create-nodes generator', () => {
  let tree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-plugin';
    tree = createTreeWithEmptyWorkspace();
    setCwd('');
    await pluginGenerator(tree, {
      directory: projectName,
      unitTestRunner: 'jest',
      linter: 'eslint',
      compiler: 'tsc',
      includeCreateNodes: false,
    });
  });

  it('should generate files', async () => {
    await createNodesGenerator(tree, {
      name: 'my-plugin',
      path: 'my-plugin/src/plugins/my-plugin/plugin',
    });

    expect(
      tree.exists('my-plugin/src/plugins/my-plugin/plugin.ts')
    ).toBeTruthy();
  });

  it('should create README when it does not exist', async () => {
    await createNodesGenerator(tree, {
      name: 'my-plugin',
      path: 'my-plugin/src/plugins/my-plugin/plugin',
    });

    const readmePath = 'my-plugin/README.md';
    expect(tree.exists(readmePath)).toBeTruthy();

    const readmeContent = tree.read(readmePath, 'utf-8');
    expect(readmeContent).toContain('## What is an Inference Plugin?');
    expect(readmeContent).toContain('## How This Plugin Works');
  });

  it('should append to existing README without duplicating content', async () => {
    const readmePath = 'my-plugin/README.md';
    tree.write(readmePath, '# My Plugin\n\nExisting content');

    await createNodesGenerator(tree, {
      name: 'my-plugin',
      path: 'my-plugin/src/plugins/my-plugin/plugin',
    });

    const readmeContent = tree.read(readmePath, 'utf-8');
    expect(readmeContent).toContain('# My Plugin');
    expect(readmeContent).toContain('Existing content');
    expect(readmeContent).toContain('## What is an Inference Plugin?');

    // Run generator again to ensure no duplication
    await createNodesGenerator(tree, {
      name: 'another-plugin',
      path: 'my-plugin/src/plugins/another-plugin/plugin',
    });

    const updatedContent = tree.read(readmePath, 'utf-8');
    const matches = updatedContent.match(/## What is an Inference Plugin\?/g);
    expect(matches?.length).toBe(1);
  });

  it('should skip README when skipReadme is true', async () => {
    await createNodesGenerator(tree, {
      name: 'my-plugin',
      path: 'my-plugin/src/plugins/my-plugin/plugin',
      skipReadme: true,
    });

    // README exists from plugin generator, but should not contain our inference plugin content
    const readmePath = 'my-plugin/README.md';
    expect(tree.exists(readmePath)).toBeTruthy();
    const readmeContent = tree.read(readmePath, 'utf-8');
    expect(readmeContent).not.toContain('## What is an Inference Plugin?');
  });

  it('should use custom targetName', async () => {
    await createNodesGenerator(tree, {
      name: 'my-plugin',
      path: 'my-plugin/src/plugins/my-plugin/plugin',
      targetName: 'custom-target',
    });

    const pluginContent = tree.read(
      'my-plugin/src/plugins/my-plugin/plugin.ts',
      'utf-8'
    );
    expect(pluginContent).toContain(
      "targetName: options.targetName ?? 'custom-target'"
    );
    expect(pluginContent).toContain("@default 'custom-target'");
  });

  it('should use custom configFile pattern', async () => {
    await createNodesGenerator(tree, {
      name: 'my-plugin',
      path: 'my-plugin/src/plugins/my-plugin/plugin',
      configFile: '**/custom.config.json',
    });

    const pluginContent = tree.read(
      'my-plugin/src/plugins/my-plugin/plugin.ts',
      'utf-8'
    );
    expect(pluginContent).toContain("'**/custom.config.json'");
  });

  it('should handle path with file extension', async () => {
    await createNodesGenerator(tree, {
      name: 'my-plugin',
      path: 'my-plugin/src/plugins/my-plugin/plugin.ts',
    });

    expect(
      tree.exists('my-plugin/src/plugins/my-plugin/plugin.ts')
    ).toBeTruthy();
  });
});
