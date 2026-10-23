import {
  ProjectConfiguration,
  ProjectGraph,
  TargetConfiguration,
} from '@nx/devkit';
import { createTaskGraph } from '../../../nx/src/tasks-runner/create-task-graph';
import { getOutputsForTargetAndConfiguration } from '../../../nx/src/tasks-runner/utils';
import {
  interpolateArgsIntoCommand,
  normalizeArgs,
} from '../../../nx/src/executors/run-commands/run-commands.impl';
import { mergeUserTargetConfigurations } from './create-nodes';

function project(): ProjectConfiguration {
  const leaf = (tfm: string): TargetConfiguration => ({
    executor: 'nx:run-commands',
    command: 'dotnet build {args.nxArgs}',
    defaultConfiguration: 'debug',
    options: { cwd: '{projectRoot}', forwardAllArgs: false },
    configurations: Object.fromEntries(
      ['debug', 'release'].map((configuration) => [
        configuration,
        {
          args: [
            '--no-restore',
            '--framework',
            tfm,
            '--configuration',
            configuration,
          ],
          nxArgs: `--no-restore --framework ${tfm} --configuration ${configuration}`,
          nxOutputs: {
            output0: `Debug/app/bin/${configuration}/${tfm}/**/*`,
            exclude1: `Debug/app/bin/${configuration}/${tfm}/**/publish/**/*`,
          },
        },
      ])
    ),
    outputs: ['{options.nxOutputs.output0}', '!{options.nxOutputs.exclude1}'],
    cache: true,
    parallelism: false,
    inputs: ['default'],
    metadata: { variantOf: 'build', targetFramework: tfm },
  });
  return {
    name: 'app',
    root: 'Debug/app',
    metadata: {
      targetGroups: {
        Build: ['build', 'build:net10.0', 'build:netstandard2.1'],
        Test: ['test'],
      },
    },
    targets: {
      build: {
        executor: 'nx:noop',
        cache: false,
        defaultConfiguration: 'debug',
        configurations: { debug: {}, release: {} },
        outputs: [],
        dependsOn: ['build:net10.0', 'build:netstandard2.1'],
      },
      'build:net10.0': leaf('net10.0'),
      'build:netstandard2.1': leaf('netstandard2.1'),
      test: { command: 'dotnet test' },
    },
  };
}

describe('TFM variant integration with Nx', () => {
  it('rejects an empty unevaluated default configuration instead of losing required arguments', () => {
    expect(() =>
      mergeUserTargetConfigurations(project(), {
        build: { defaultConfiguration: '' },
      })
    ).toThrow(/Unsupported default configuration/);
  });

  it.each([undefined, 'debug', 'release'])(
    'schedules the aggregate and every matching %s leaf configuration',
    (configuration) => {
      const data = mergeUserTargetConfigurations(project(), {});
      const graph: ProjectGraph = {
        nodes: { app: { name: 'app', type: 'lib', data } },
        dependencies: { app: [] },
      };
      const tasks = createTaskGraph(
        graph,
        {},
        ['app'],
        ['build'],
        configuration,
        {}
      );
      const config = configuration ?? 'debug';
      expect(Object.keys(tasks.tasks).sort()).toEqual(
        [
          `app:build:${config}`,
          `app:build:net10.0:${config}`,
          `app:build:netstandard2.1:${config}`,
        ].sort()
      );
      expect(tasks.tasks[`app:build:${config}`].cache).toBe(false);
      expect(
        tasks.dependencies[`app:build:${config}`].map((edge) => edge.id).sort()
      ).toEqual(
        [
          `app:build:net10.0:${config}`,
          `app:build:netstandard2.1:${config}`,
        ].sort()
      );
      for (const tfm of ['net10.0', 'netstandard2.1']) {
        const task = tasks.tasks[`app:build:${tfm}:${config}`];
        expect(task.outputs).toEqual([
          `Debug/app/bin/${config}/${tfm}/**/*`,
          `!Debug/app/bin/${config}/${tfm}/**/publish/**/*`,
        ]);
        expect(tasks.dependencies[task.id]).toEqual([]);
      }
    }
  );

  it('preserves required arguments and user args through actual command interpolation', () => {
    const result = mergeUserTargetConfigurations(project(), {
      build: {
        options: { args: ['--verbosity', 'quiet'], env: { CUSTOM: 'yes' } },
        configurations: {
          release: { args: '-p:DefineConstants=RELEASE_BUILD' },
        },
      },
    });
    const leaf = result.targets!['build:net10.0'];
    const options = { ...leaf.options, ...leaf.configurations!.release };
    const command = interpolateArgsIntoCommand(
      leaf.command!,
      normalizeArgs({ ...options, __unparsed__: [] }),
      false
    );
    expect(command).toBe(
      'dotnet build --no-restore --framework net10.0 --configuration release --verbosity quiet -p:DefineConstants=RELEASE_BUILD'
    );
    expect(command).not.toContain('nxOutputs');
    expect(leaf.options.env).toEqual({ CUSTOM: 'yes' });
    expect(result.targets!.build.executor).toBe('nx:noop');
  });

  it.each([
    '--framework net8.0',
    '-f:net8.0',
    '--configuration=Debug',
    '-c Release',
    '--runtime osx-arm64',
    '-r=win-x64',
    '-p:TargetFramework=net8.0',
    '/property:Other=value;Configuration=Debug',
    '--output another',
    '--arch arm64',
    '-p:TargetFrameworks=net8.0',
    '-p:AppendTargetFrameworkToOutputPath=false',
    '@override.rsp',
    '--nxArgs=--no-restore',
    '--nx-args=--no-restore',
    '--nx--args=--no-restore',
    '"--nxArgs"=--no-restore',
    '--nxOutputs.output0=somewhere',
    '--nx-outputs=somewhere',
    '--forwardAllArgs',
    '--forward-all-args',
  ])('rejects contradictory user arguments: %s', (args) => {
    expect(() =>
      mergeUserTargetConfigurations(project(), {
        build: { options: { args } },
      })
    ).toThrow(/Cannot override/);
  });

  it('keeps user execution options, additional CLI options, inputs, and non-build prerequisites', () => {
    const result = mergeUserTargetConfigurations(project(), {
      build: {
        options: { verbosity: 'quiet', env: { CUSTOM: 'yes' } },
        inputs: ['{workspaceRoot}/custom-input.txt'],
        dependsOn: ['codegen', '^build'],
      },
    });
    const leaf = result.targets!['build:net10.0'];
    expect(leaf.configurations!.debug.nxArgs).toContain('--verbosity=quiet');
    expect(leaf.options.env).toEqual({ CUSTOM: 'yes' });
    expect(leaf.inputs).toEqual([
      'default',
      '{workspaceRoot}/custom-input.txt',
    ]);
    expect(leaf.dependsOn).toEqual(['codegen']);
    expect(leaf.parallelism).toBe(false);
  });

  it.each([{ parallelism: true }, { outputs: ['{projectRoot}/bin'] }])(
    'rejects unsafe ownership overrides %j',
    (build) => {
      expect(() => mergeUserTargetConfigurations(project(), { build })).toThrow(
        /execution\/cache safety/
      );
    }
  );

  it('does not re-enable caching disabled for evaluated safety reasons', () => {
    const data = project();
    data.targets!['build:net10.0'].cache = false;
    expect(() =>
      mergeUserTargetConfigurations(data, { build: { cache: true } })
    ).toThrow(/execution\/cache safety/);
  });

  it('rejects hidden unparsed executor arguments', () => {
    expect(() =>
      mergeUserTargetConfigurations(project(), {
        build: { options: { __unparsed__: ['--nxArgs=--no-restore'] } },
      })
    ).toThrow(/Cannot override/);
  });

  it('uses the same default Release configuration on aggregate and leaves', () => {
    const data = mergeUserTargetConfigurations(project(), {
      build: { defaultConfiguration: 'release' },
    });
    const graph: ProjectGraph = {
      nodes: { app: { name: 'app', type: 'lib', data } },
      dependencies: { app: [] },
    };
    const result = createTaskGraph(
      graph,
      {},
      ['app'],
      ['build'],
      undefined,
      {}
    );
    expect(
      Object.values(result.tasks).map((task) => task.target.configuration)
    ).toEqual(['release', 'release', 'release']);
  });

  it('removes disabled variants and keeps independent target groups', () => {
    const result = mergeUserTargetConfigurations(project(), { build: false });
    expect(Object.keys(result.targets!)).toEqual(['test']);
    expect(result.metadata!.targetGroups).toEqual({
      Build: [],
      Test: ['test'],
    });
  });

  it('resolves Release outputs without rewriting a project directory called Debug', () => {
    const data = project();
    const outputs = getOutputsForTargetAndConfiguration(
      { project: 'app', target: 'build:net10.0', configuration: 'release' },
      {},
      { name: 'app', type: 'lib', data }
    );
    expect(outputs[0]).toBe('Debug/app/bin/release/net10.0/**/*');
  });
});
