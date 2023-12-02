import { Tree } from 'nx/src/generators/tree';
import { CreateNodes } from 'nx/src/utils/nx-plugin';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import {
  addProjectConfiguration,
  readProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';

import { replaceProjectConfigurationsWithPlugin } from './replace-project-configuration-with-plugin';

describe('replaceProjectConfigurationsWithPlugin', () => {
  let tree: Tree;
  let createNodes: CreateNodes;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('proj/file.txt', '');
    createNodes = [
      'proj/file.txt',
      () => ({
        projects: {
          proj: {
            root: 'proj',
            targets: {
              build: {
                executor: 'nx:run-commands',
                dependsOn: ['^build-base'],
                inputs: ['default', '^default'],
                outputs: ['{options.output}', '{projectRoot}/outputs'],
                options: {
                  configFile: 'file.txt',
                },
                configurations: {
                  production: {
                    configFile: 'file.prod.txt',
                  },
                },
              },
            },
          },
        },
      }),
    ];
  });

  it('should not update the target when it uses a different executor', async () => {
    const buildTarget = {
      executor: 'nx:run-script',
      inputs: ['default', '^default'],
      outputs: ['{options.output}', '{projectRoot}/outputs'],
      options: {
        configFile: 'file.txt',
      },
    };
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: buildTarget,
      },
    });

    await replaceProjectConfigurationsWithPlugin(
      tree,
      new Map([['proj', 'proj']]),
      'plugin-path',
      createNodes,
      {}
    );

    expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual(
      buildTarget
    );
  });

  describe('options', () => {
    it('should be removed when there are no other options', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            inputs: ['default', '^default'],
            outputs: ['{options.output}', '{projectRoot}/outputs'],
            options: {
              configFile: 'file.txt',
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(
        readProjectConfiguration(tree, 'proj').targets.build
      ).toBeUndefined();
    });

    it('should not be removed when there are other options', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            inputs: ['default', '^default'],
            outputs: ['{options.output}', '{projectRoot}/outputs'],
            options: {
              configFile: 'file.txt',
              watch: false,
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        options: {
          watch: false,
        },
      });
    });
  });

  describe('inputs', () => {
    it('should not be removed if there are additional inputs', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            inputs: ['default', '^default', '{workspaceRoot}/file.txt'],
            outputs: ['{options.output}', '{projectRoot}/outputs'],
            options: {
              configFile: 'file.txt',
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        inputs: ['default', '^default', '{workspaceRoot}/file.txt'],
      });
    });

    it('should not be removed if there are additional inputs which are objects', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            inputs: [
              'default',
              '^default',
              {
                env: 'HOME',
              },
            ],
            outputs: ['{options.output}', '{projectRoot}/outputs'],
            options: {
              configFile: 'file.txt',
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        inputs: [
          'default',
          '^default',
          {
            env: 'HOME',
          },
        ],
      });
    });

    it('should not be removed if there are less inputs', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            inputs: ['default'],
            outputs: ['{options.output}', '{projectRoot}/outputs'],
            options: {
              configFile: 'file.txt',
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        inputs: ['default'],
      });
    });
  });

  describe('outputs', () => {
    it('should not be removed if there are additional outputs', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            inputs: ['default', '^default'],
            outputs: [
              '{options.output}',
              '{projectRoot}/outputs',
              '{projectRoot}/more-outputs',
            ],
            options: {
              configFile: 'file.txt',
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        outputs: [
          '{options.output}',
          '{projectRoot}/outputs',
          '{projectRoot}/more-outputs',
        ],
      });
    });

    it('should not be removed if there are less outputs', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            outputs: ['{options.output}'],
            options: {
              configFile: 'file.txt',
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        outputs: ['{options.output}'],
      });
    });
  });

  describe('dependsOn', () => {
    it('should be removed when it is the same', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            dependsOn: ['^build-base'],
            options: {
              configFile: 'file.txt',
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(
        readProjectConfiguration(tree, 'proj').targets.build
      ).toBeUndefined();
    });

    it('should not be removed when there are more dependent tasks', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            dependsOn: ['^build-base', 'prebuild'],
            options: {
              configFile: 'file.txt',
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        dependsOn: ['^build-base', 'prebuild'],
      });
    });

    it('should not be removed when there are less dependent tasks', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            dependsOn: [],
            options: {
              configFile: 'file.txt',
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        dependsOn: [],
      });
    });
  });

  describe('defaultConfiguration', () => {
    it('should not be removed when the defaultConfiguration is different', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              configFile: 'file.txt',
            },
            defaultConfiguration: 'other',
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        defaultConfiguration: 'other',
      });
    });
  });

  describe('configurations', () => {
    it('should not be removed when an additional configuration is defined', async () => {
      addProjectConfiguration(tree, 'proj', {
        root: 'proj',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              configFile: 'file.txt',
            },
            configurations: {
              other: {
                configFile: 'other-file.txt',
              },
            },
          },
        },
      });

      await replaceProjectConfigurationsWithPlugin(
        tree,
        new Map([['proj', 'proj']]),
        'plugin-path',
        createNodes,
        {}
      );

      expect(readProjectConfiguration(tree, 'proj').targets.build).toEqual({
        configurations: {
          other: {
            configFile: 'other-file.txt',
          },
        },
      });
    });
  });
});
