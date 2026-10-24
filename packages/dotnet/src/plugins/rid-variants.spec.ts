import type {
  ProjectConfiguration,
  ProjectGraph,
  TargetConfiguration,
} from '@nx/devkit';
import { createTaskGraph } from '../../../nx/src/tasks-runner/create-task-graph';
import {
  interpolateArgsIntoCommand,
  normalizeArgs,
} from '../../../nx/src/executors/run-commands/run-commands.impl';
import {
  DotNetPluginOptions,
  mergeUserTargetConfigurations,
} from './create-nodes';

const publishPreparation =
  'node -e "require(\'node:fs\').rmSync(process.env.NX_DOTNET_PUBLISH_DIRECTORY, {recursive:true,force:true})" && ';

function project(): ProjectConfiguration {
  const leaf = (command: 'build' | 'publish'): TargetConfiguration => ({
    executor: 'nx:run-commands',
    command: `${command === 'publish' ? publishPreparation : ''}dotnet ${command} {args.nxArgs}`,
    defaultConfiguration: 'release',
    options: { cwd: '{projectRoot}', forwardAllArgs: false },
    configurations: Object.fromEntries(
      ['debug', 'release'].map((configuration) => [
        configuration,
        {
          args: [
            ...(command === 'publish' ? ['--no-build'] : []),
            '--no-restore',
            '--framework',
            'net10.0',
            '--runtime',
            'osx-arm64',
            '--configuration',
            configuration,
          ],
          nxArgs: `${command === 'publish' ? '--no-build ' : ''}--no-restore --framework net10.0 --runtime osx-arm64 --configuration ${configuration}`,
          nxOutputs: {
            output0: `apps/app/bin/${configuration}/net10.0/osx-arm64/${command === 'publish' ? 'publish/' : ''}**/*`,
          },
          ...(command === 'publish' && {
            env: {
              NX_DOTNET_PUBLISH_DIRECTORY: `bin/${configuration}/net10.0/osx-arm64/publish`,
            },
          }),
        },
      ])
    ),
    outputs: ['{options.nxOutputs.output0}'],
    cache: true,
    parallelism: false,
    inputs: [
      'default',
      { dependentTasksOutputFiles: '**/*', transitive: true },
    ],
    metadata: {
      variantOf: command,
      targetFramework: 'net10.0',
      runtimeIdentifier: 'osx-arm64',
    },
  });
  return {
    name: 'app',
    root: 'apps/app',
    metadata: {
      targetGroups: {
        Build: ['build'],
        'build (RID)': ['build:net10.0:osx-arm64'],
        'publish (RID)': ['publish:net10.0:osx-arm64'],
      },
    },
    targets: {
      build: { executor: 'nx:noop', cache: false, outputs: [] },
      publish: { command: 'dotnet publish' },
      'build:net10.0:osx-arm64': leaf('build'),
      'publish:net10.0:osx-arm64': {
        ...leaf('publish'),
        dependsOn: ['build:net10.0:osx-arm64'],
      },
    },
  };
}

describe('RID configuration and plugin merge contract', () => {
  it.each([undefined, 'release', 'debug'])(
    'resolves publish and build to the same configuration (%s)',
    (configuration) => {
      const data = mergeUserTargetConfigurations(project(), {});
      const graph: ProjectGraph = {
        nodes: { app: { name: 'app', type: 'app', data } },
        dependencies: { app: [] },
      };
      const tasks = createTaskGraph(
        graph,
        {},
        ['app'],
        ['publish:net10.0:osx-arm64'],
        configuration,
        {}
      );
      const resolved = configuration ?? 'release';
      const build = `app:build:net10.0:osx-arm64:${resolved}`;
      const publish = `app:publish:net10.0:osx-arm64:${resolved}`;

      expect(Object.keys(tasks.tasks).sort()).toEqual([build, publish].sort());
      expect(
        tasks.dependencies[publish].map((dependency) => dependency.id)
      ).toEqual([build]);
      expect(tasks.tasks[build].outputs).toEqual([
        `apps/app/bin/${resolved}/net10.0/osx-arm64/**/*`,
      ]);
      expect(tasks.tasks[publish].outputs).toEqual([
        `apps/app/bin/${resolved}/net10.0/osx-arm64/publish/**/*`,
      ]);
    }
  );

  it('keeps runtime, framework, configuration and no-build when merging extra flags', () => {
    const data = mergeUserTargetConfigurations(project(), {
      publish: {
        options: { args: ['--verbosity', 'minimal'] },
        configurations: { debug: { args: ['--nologo'] } },
      },
    });
    const leaf = data.targets!['publish:net10.0:osx-arm64'];
    const options = { ...leaf.options, ...leaf.configurations!.debug };
    const command = interpolateArgsIntoCommand(
      leaf.command!,
      normalizeArgs({ ...options, __unparsed__: [] }),
      false
    );

    expect(command).toBe(
      `${publishPreparation}dotnet publish --no-build --no-restore --framework net10.0 --runtime osx-arm64 --configuration debug --verbosity minimal --nologo`
    );
    expect(command).not.toContain('nxOutputs');
  });

  it('removes both RID task families when build is disabled', () => {
    const data = mergeUserTargetConfigurations(project(), { build: false });

    expect(data.targets!['build:net10.0:osx-arm64']).toBeUndefined();
    expect(data.targets!['publish:net10.0:osx-arm64']).toBeUndefined();
    expect(data.metadata!.targetGroups!['build (RID)']).toEqual([]);
    expect(data.metadata!.targetGroups!['publish (RID)']).toEqual([]);
  });

  it('keeps explicit RID builds when publish is disabled', () => {
    const data = mergeUserTargetConfigurations(project(), { publish: false });

    expect(data.targets!['build:net10.0:osx-arm64']).toBeDefined();
    expect(data.targets!['publish:net10.0:osx-arm64']).toBeUndefined();
  });

  it('merges RID publish options even when a mixed library/app project has no base publish', () => {
    const node = project();
    delete node.targets!.publish;

    const data = mergeUserTargetConfigurations(node, {
      publish: { options: { args: ['--verbosity', 'quiet'] } },
    });

    expect(
      data.targets!['publish:net10.0:osx-arm64'].configurations!.release.nxArgs
    ).toContain(
      '--runtime osx-arm64 --configuration release --verbosity quiet'
    );
  });

  it.each<DotNetPluginOptions>([
    { ridVariants: false },
    { tfmVariants: false, ridVariants: true },
  ])('preserves explicit variant opt-outs (%j)', (options) => {
    const data = mergeUserTargetConfigurations(project(), options);

    expect(data.targets!['build:net10.0:osx-arm64']).toBeUndefined();
    expect(data.targets!['publish:net10.0:osx-arm64']).toBeUndefined();
  });

  it.each<DotNetPluginOptions>([
    { build: { defaultConfiguration: 'debug' } },
    { publish: { defaultConfiguration: 'debug' } },
  ])(
    'rejects incompatible default overrides instead of scheduling mismatched tasks (%j)',
    (options) => {
      expect(() => mergeUserTargetConfigurations(project(), options)).toThrow(
        /must default to release/
      );
    }
  );

  it.each([
    '--runtime linux-x64',
    '-p:RuntimeIdentifier=win-x64',
    '-p:Other=1;RuntimeIdentifiers=linux-x64',
    '--nxArgs=--no-restore',
    '--nx-args=--no-restore',
    '--nx--args=--no-restore',
    '--nxOutputs=elsewhere',
    '--nx-outputs.output0=elsewhere',
    '--forwardAllArgs=true',
    '--__unparsed__=--no-restore',
  ])('rejects runtime overrides from base target configuration: %s', (args) => {
    expect(() =>
      mergeUserTargetConfigurations(project(), {
        publish: { configurations: { release: { args } } },
      })
    ).toThrow(/Cannot override/);
  });

  it('rejects raw executor argument overrides that could replace the protected command', () => {
    expect(() =>
      mergeUserTargetConfigurations(project(), {
        build: { options: { __unparsed__: ['--nxArgs=--no-restore'] } },
      })
    ).toThrow(/Cannot override/);
  });

  it('keeps the generated evaluated publish directory for each configuration', () => {
    const data = mergeUserTargetConfigurations(project(), {});
    const leaf = data.targets!['publish:net10.0:osx-arm64'];

    expect(leaf.configurations!.debug.env).toEqual({
      NX_DOTNET_PUBLISH_DIRECTORY: 'bin/debug/net10.0/osx-arm64/publish',
    });
    expect(leaf.configurations!.release.env).toEqual({
      NX_DOTNET_PUBLISH_DIRECTORY: 'bin/release/net10.0/osx-arm64/publish',
    });
  });

  it.each(['NX_DOTNET_PUBLISH_DIRECTORY', 'nx_dotnet_publish_directory'])(
    'rejects overrides of the evaluated cleanup directory through %s',
    (key) => {
      expect(() =>
        mergeUserTargetConfigurations(project(), {
          publish: {
            configurations: { debug: { env: { [key]: '../wrong' } } },
          },
        })
      ).toThrow(/Cannot override|environment|env/);
    }
  );

  it.each<DotNetPluginOptions>([
    { publish: { options: { env: { BASE_VALUE: 'base' } } } },
    { build: { options: { envFile: 'build.env' } } },
    {
      publish: {
        configurations: { debug: { env: { CONFIG_VALUE: 'debug' } } },
      },
    },
    { publish: { configurations: { release: { envFile: 'release.env' } } } },
  ])(
    'rejects user runtime environments not included in evaluated RID facts (%j)',
    (options) => {
      expect(() => mergeUserTargetConfigurations(project(), options)).toThrow(
        /tfmVariants.*false/
      );
    }
  );
});
