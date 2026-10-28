import { ProjectConfiguration, TargetConfiguration } from '@nx/devkit';
import { mergeTargetConfigurations } from '@nx/devkit/internal';
import { minimatch } from 'minimatch';
import {
  createNodes,
  DotNetPluginOptions,
  mergeUserTargetConfigurations,
} from './create-nodes';

describe('@nx/dotnet - createNodes', () => {
  describe('mergeUserTargetConfigurations', () => {
    it('should return node unchanged when no options provided', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
            },
          },
        },
      };

      const result = mergeUserTargetConfigurations(node, {});
      expect(result).toEqual(node);
    });

    it('should return node unchanged when no targets exist', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
      };

      const result = mergeUserTargetConfigurations(node, {
        build: { targetName: 'compile' },
      });
      expect(result).toEqual(node);
    });

    it('should merge user options into generated target', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
              cwd: 'apps/my-app',
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        build: {
          options: {
            additionalOption: 'value',
          },
        },
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.build).toEqual({
        executor: 'nx:run-commands',
        options: {
          command: 'dotnet build',
          cwd: 'apps/my-app',
          additionalOption: 'value',
        },
      });
    });

    it('should merge user configurations into generated target', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
            },
            configurations: {
              debug: {
                configuration: 'Debug',
              },
              release: {
                configuration: 'Release',
              },
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        build: {
          configurations: {
            production: {
              optimization: true,
            },
          },
        },
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.build?.configurations).toEqual({
        debug: {
          configuration: 'Debug',
        },
        release: {
          configuration: 'Release',
        },
        production: {
          optimization: true,
        },
      });
    });

    it('should rename target when targetName is specified', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        build: {
          targetName: 'compile',
          options: {
            additionalOption: 'value',
          },
        },
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.compile).toBeDefined();
      expect(result.targets?.build).toBeUndefined();
      expect(result.targets?.compile?.options).toEqual({
        command: 'dotnet build',
        additionalOption: 'value',
      });
    });

    it('should handle multiple target configurations', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
            },
          },
          test: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet test',
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        build: {
          targetName: 'compile',
        },
        test: {
          targetName: 'unit-test',
          options: {
            logger: 'console',
          },
        },
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.compile).toBeDefined();
      expect(result.targets?.build).toBeUndefined();
      expect(result.targets?.['unit-test']).toBeDefined();
      expect(result.targets?.test).toBeUndefined();
      expect(result.targets?.['unit-test']?.options).toEqual({
        command: 'dotnet test',
        logger: 'console',
      });
    });

    it('should add dependsOn to target', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          test: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet test',
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        test: {
          dependsOn: ['build'],
        },
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.test?.dependsOn).toEqual(['build']);
    });

    it('should handle cache configuration', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        build: {
          cache: true,
          inputs: ['{projectRoot}/**/*.cs', '^production'],
          outputs: ['{projectRoot}/bin'],
        },
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.build?.cache).toBe(true);
      expect(result.targets?.build?.inputs).toEqual([
        '{projectRoot}/**/*.cs',
        '^production',
      ]);
      expect(result.targets?.build?.outputs).toEqual(['{projectRoot}/bin']);
    });

    it('should rename target even when no other config is provided', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        build: {
          targetName: 'compile',
          // No other config, but should still rename
        },
      };

      const result = mergeUserTargetConfigurations(node, options);

      // Target should be renamed even with no other config
      expect(result.targets?.compile).toBeDefined();
      expect(result.targets?.build).toBeUndefined();
      expect(result.targets?.compile).toEqual({
        executor: 'nx:run-commands',
        options: {
          command: 'dotnet build',
        },
      });
    });

    it('should handle all target types', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: { command: 'dotnet build' },
          },
          test: {
            executor: 'nx:run-commands',
            options: { command: 'dotnet test' },
          },
          clean: {
            executor: 'nx:run-commands',
            options: { command: 'dotnet clean' },
          },
          restore: {
            executor: 'nx:run-commands',
            options: { command: 'dotnet restore' },
          },
          publish: {
            executor: 'nx:run-commands',
            options: { command: 'dotnet publish' },
          },
          pack: {
            executor: 'nx:run-commands',
            options: { command: 'dotnet pack' },
          },
        },
      };

      const options: DotNetPluginOptions = {
        build: { options: { b: 1 } },
        test: { options: { t: 2 } },
        clean: { options: { c: 3 } },
        restore: { options: { r: 4 } },
        publish: { options: { p: 5 } },
        pack: { options: { pk: 6 } },
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.build?.options).toEqual({
        command: 'dotnet build',
        b: 1,
      });
      expect(result.targets?.test?.options).toEqual({
        command: 'dotnet test',
        t: 2,
      });
      expect(result.targets?.clean?.options).toEqual({
        command: 'dotnet clean',
        c: 3,
      });
      expect(result.targets?.restore?.options).toEqual({
        command: 'dotnet restore',
        r: 4,
      });
      expect(result.targets?.publish?.options).toEqual({
        command: 'dotnet publish',
        p: 5,
      });
      expect(result.targets?.pack?.options).toEqual({
        command: 'dotnet pack',
        pk: 6,
      });
    });

    it('should override existing options when user provides same option', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
              cwd: 'apps/my-app',
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        build: {
          options: {
            cwd: 'different/path',
          },
        },
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.build?.options?.cwd).toBe('different/path');
    });

    it('should handle complex nested configurations', () => {
      const node: ProjectConfiguration = {
        root: 'libs/my-lib',
        name: 'my-lib',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
            },
            configurations: {
              debug: {
                configuration: 'Debug',
              },
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        build: {
          targetName: 'compile',
          options: {
            verbose: true,
          },
          configurations: {
            release: {
              configuration: 'Release',
              optimization: true,
            },
          },
          cache: true,
          inputs: ['default', '^production'],
          outputs: ['{projectRoot}/bin/{configuration}'],
          dependsOn: ['^build'],
        },
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.compile).toBeDefined();
      expect(result.targets?.build).toBeUndefined();
      expect(result.targets?.compile).toMatchObject({
        executor: 'nx:run-commands',
        options: {
          command: 'dotnet build',
          verbose: true,
        },
        configurations: {
          debug: {
            configuration: 'Debug',
          },
          release: {
            configuration: 'Release',
            optimization: true,
          },
        },
        cache: true,
        inputs: ['default', '^production'],
        outputs: ['{projectRoot}/bin/{configuration}'],
        dependsOn: ['^build'],
      });
    });

    it('should remove disabled targets from configuration', () => {
      const node: ProjectConfiguration = {
        root: 'apps/my-app',
        name: 'my-app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet build',
            },
          },
          test: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet test',
            },
          },
          clean: {
            executor: 'nx:run-commands',
            options: {
              command: 'dotnet clean',
            },
          },
        },
      };

      const options: DotNetPluginOptions = {
        test: false,
        clean: false,
      };

      const result = mergeUserTargetConfigurations(node, options);

      expect(result.targets?.build).toBeDefined();
      expect(result.targets?.test).toBeUndefined();
      expect(result.targets?.clean).toBeUndefined();
    });
  });

  describe('restore target', () => {
    // restore isn't cached and isn't part of the task chain, so running it
    // through Nx buys nothing over `dotnet restore`. It is opt-in.
    const nodeWithRestore = (): ProjectConfiguration => ({
      root: 'apps/my-app',
      name: 'my-app',
      targets: {
        build: {
          executor: 'nx:run-commands',
          options: { command: 'dotnet build' },
        },
        restore: {
          executor: 'nx:run-commands',
          options: { command: 'dotnet restore' },
        },
        watch: {
          executor: 'nx:run-commands',
          dependsOn: ['restore'],
          options: { command: 'dotnet watch' },
        },
      },
    });

    it('should remove the restore target when it is not configured', () => {
      const result = mergeUserTargetConfigurations(nodeWithRestore(), {});

      expect(result.targets?.restore).toBeUndefined();
      expect(result.targets?.build).toBeDefined();
    });

    it('should remove the restore target when the plugin has no options at all', () => {
      const result = mergeUserTargetConfigurations(
        nodeWithRestore(),
        undefined
      );

      expect(result.targets?.restore).toBeUndefined();
    });

    it('should drop the removed restore target from other targets dependsOn', () => {
      const result = mergeUserTargetConfigurations(nodeWithRestore(), {});

      expect(result.targets?.watch?.dependsOn).toEqual([]);
    });

    it('should keep the restore target when opted in with true', () => {
      const result = mergeUserTargetConfigurations(nodeWithRestore(), {
        restore: true,
      });

      expect(result.targets?.restore).toBeDefined();
      expect(result.targets?.watch?.dependsOn).toEqual(['restore']);
    });

    it('should keep the restore target when opted in with a configuration object', () => {
      const result = mergeUserTargetConfigurations(nodeWithRestore(), {
        restore: { options: { args: ['--interactive'] } },
      });

      expect(result.targets?.restore?.options).toEqual({
        command: 'dotnet restore',
        args: ['--interactive'],
      });
    });

    it('should still remove the restore target when explicitly disabled', () => {
      const result = mergeUserTargetConfigurations(nodeWithRestore(), {
        restore: false,
      });

      expect(result.targets?.restore).toBeUndefined();
    });

    it('should keep every other target enabled by default', () => {
      const result = mergeUserTargetConfigurations(nodeWithRestore(), {});

      expect(result.targets?.build).toBeDefined();
      expect(result.targets?.watch).toBeDefined();
    });
  });

  describe('target name extraction', () => {
    it('should extract default target names when not specified', () => {
      const options: DotNetPluginOptions = {
        build: {},
        test: {},
      };

      const buildTargetName =
        (options.build && options.build.targetName) || 'build';
      const testTargetName =
        (options.test && options.test.targetName) || 'test';

      expect(buildTargetName).toBe('build');
      expect(testTargetName).toBe('test');
    });

    it('should extract custom target names when specified', () => {
      const options: DotNetPluginOptions = {
        build: { targetName: 'compile' },
        test: { targetName: 'unit-test' },
      };

      const buildTargetName =
        (options.build && options.build.targetName) || 'build';
      const testTargetName =
        (options.test && options.test.targetName) || 'test';

      expect(buildTargetName).toBe('compile');
      expect(testTargetName).toBe('unit-test');
    });

    it('should handle mixed default and custom names', () => {
      const options: DotNetPluginOptions = {
        build: { targetName: 'compile' },
        test: {},
        clean: { targetName: 'cleanup' },
      };

      const buildTargetName =
        (options.build && options.build.targetName) || 'build';
      const testTargetName =
        (options.test && options.test.targetName) || 'test';
      const cleanTargetName =
        (options.clean && options.clean.targetName) || 'clean';

      expect(buildTargetName).toBe('compile');
      expect(testTargetName).toBe('test');
      expect(cleanTargetName).toBe('cleanup');
    });
  });

  describe('config file glob', () => {
    const [glob] = createNodes;
    const matches = (path: string) => minimatch(path, glob);

    it.each([
      'apps/api/Api.csproj',
      'libs/core/Core.fsproj',
      'Directory.Build.props',
      'apps/Directory.Packages.props',
      'Directory.Build.rsp',
      'build/Common.Build.props',
      'eng/Versions.targets',
      'global.json',
      'nuget.config',
      'NuGet.Config',
      '.editorconfig',
      'apps/api/.editorconfig',
    ])('should match %s', (path) => {
      expect(matches(path)).toBe(true);
    });

    it.each([
      'apps/api/Program.cs',
      'package.json',
      'apps/api/appsettings.json',
    ])('should not match %s', (path) => {
      expect(matches(path)).toBe(false);
    });
  });
});
