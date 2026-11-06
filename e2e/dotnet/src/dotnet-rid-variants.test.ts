import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCommand,
  tmpProjPath,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import type { ProjectConfiguration, TaskGraph } from '@nx/devkit';
import { existsSync, readFileSync, rmSync } from 'node:fs';

type GraphFileTasks = Omit<TaskGraph, 'dependencies'> & {
  dependencies: Record<string, Array<{ id: string }>>;
};

describe('.NET Plugin - RID variants', () => {
  beforeAll(() => {
    newProject({ packages: [] });
    runCLI('add @nx/dotnet');
    updateFile(
      'RidApp/RidApp.csproj',
      `<Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup>
          <TargetFrameworks>net8.0;netstandard2.1</TargetFrameworks>
          <OutputType Condition="'$(TargetFramework)' == 'net8.0'">Exe</OutputType>
          <RuntimeIdentifiers Condition="'$(TargetFramework)' == 'net8.0'">linux-x64;win-x64</RuntimeIdentifiers>
          <RollForward>LatestMajor</RollForward>
        </PropertyGroup>
        <ItemGroup>
          <ProjectReference Include="../Common/Common.csproj" />
        </ItemGroup>
      </Project>`
    );
    updateFile(
      'RidApp/Program.cs',
      'class Program { static void Main() { System.Console.WriteLine(Common.Message.Value); } }'
    );
    updateFile(
      'Common/Common.csproj',
      '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>netstandard2.1</TargetFramework></PropertyGroup><ItemGroup><Compile Include="../Shared/Version.cs" Link="Version.cs" /></ItemGroup></Project>'
    );
    updateFile(
      'Common/Message.cs',
      'namespace Common { public static class Message { public static string Value => Shared.Version.Value; } }'
    );
    updateFile(
      'Shared/Version.cs',
      'namespace Shared { public static class Version { public const string Value = "rid-variant"; } }'
    );
    updateFile('.gitignore', 'node_modules/\n.nx/\n**/bin/\n**/obj/\n');
    runCommand('dotnet restore RidApp/RidApp.csproj');
  });

  afterAll(() => cleanupProject());

  function setOptions(options: Record<string, unknown>) {
    updateJson('nx.json', (nxJson) => {
      nxJson.plugins = nxJson.plugins.map(
        (plugin: string | { plugin: string }) => {
          if (
            plugin === '@nx/dotnet' ||
            (typeof plugin !== 'string' && plugin.plugin === '@nx/dotnet')
          ) {
            return { plugin: '@nx/dotnet', options };
          }
          return plugin;
        }
      );
      return nxJson;
    });
  }

  function graph(target: string, configuration?: string): GraphFileTasks {
    runCLI(
      `run RidApp:${target}${configuration ? ` --configuration=${configuration}` : ''} --graph=rid-graph.json`
    );
    return readJson('rid-graph.json').tasks;
  }

  it('infers colon targets by default, without separate Release targets', () => {
    const project: ProjectConfiguration = JSON.parse(
      runCLI('show project RidApp --json')
    );
    const targets = project.targets!;

    expect(targets['build:net8.0:linux-x64']).toBeDefined();
    expect(targets['publish:net8.0:linux-x64']).toBeDefined();
    expect(targets['build:net8.0:win-x64']).toBeDefined();
    expect(targets['publish:net8.0:win-x64']).toBeDefined();
    expect(targets['build:netstandard2.1:linux-x64']).toBeUndefined();
    expect(
      Object.keys(targets).some(
        (name) =>
          name.endsWith('-release') || name.endsWith(':linux-x64:release')
      )
    ).toBe(false);
    expect(targets['publish:net8.0:linux-x64'].metadata).toMatchObject({
      variantOf: 'publish',
      targetFramework: 'net8.0',
      runtimeIdentifier: 'linux-x64',
    });
  });

  it('keeps RID tasks outside the ordinary build aggregate', () => {
    const tasks = graph('build');

    expect(
      Object.values(tasks.tasks)
        .map((task) => task.target.target)
        .sort()
    ).toEqual(['build', 'build:net8.0', 'build:netstandard2.1']);
  });

  it.each([undefined, 'release', 'debug'])(
    'resolves publish and its build to the same configuration (%s)',
    (configuration) => {
      const resolvedConfiguration = configuration ?? 'release';
      const tasks = graph('publish:net8.0:linux-x64', configuration);
      const publish = `RidApp:publish:net8.0:linux-x64:${resolvedConfiguration}`;
      const build = `RidApp:build:net8.0:linux-x64:${resolvedConfiguration}`;

      expect(Object.keys(tasks.tasks).sort()).toEqual([build, publish].sort());
      expect(
        tasks.dependencies[publish].map((dependency) => dependency.id)
      ).toEqual([build]);
      expect(tasks.tasks[build].target.configuration).toBe(
        resolvedConfiguration
      );
      expect(tasks.tasks[build].outputs).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            `/bin/${resolvedConfiguration === 'debug' ? 'Debug' : 'Release'}/net8.0/linux-x64/`
          ),
        ])
      );
    }
  );

  it.each(['release', 'debug'])(
    'executes a matching no-build publish and restores only its RID/configuration (%s)',
    (configuration) => {
      const msbuildConfiguration =
        configuration === 'debug' ? 'Debug' : 'Release';
      const command = `run RidApp:publish:net8.0:linux-x64 --configuration=${configuration}`;
      runCLI(command);
      const published = `RidApp/bin/${msbuildConfiguration}/net8.0/linux-x64/publish/RidApp.dll`;
      checkFilesExist(published);
      expect(runCommand(`dotnet ${published}`).trim()).toBe('rid-variant');

      const sibling = tmpProjPath(
        `RidApp/bin/${msbuildConfiguration}/net8.0/win-x64`
      );
      updateFile(
        `RidApp/bin/${msbuildConfiguration}/net8.0/win-x64/sentinel`,
        'keep-sibling'
      );
      const otherConfiguration =
        msbuildConfiguration === 'Debug' ? 'Release' : 'Debug';
      const other = `RidApp/bin/${otherConfiguration}/net8.0/linux-x64/sentinel`;
      updateFile(other, 'keep-configuration');
      rmSync(
        tmpProjPath(`RidApp/bin/${msbuildConfiguration}/net8.0/linux-x64`),
        { recursive: true, force: true }
      );
      rmSync(tmpProjPath('Common/bin'), { recursive: true, force: true });
      rmSync(tmpProjPath(`Common/obj/${msbuildConfiguration}`), {
        recursive: true,
        force: true,
      });

      const cached = runCLI(command);
      expect(cached).toContain('local cache');
      checkFilesExist(published);
      checkFilesExist(
        `Common/bin/${msbuildConfiguration}/netstandard2.1/Common.dll`
      );
      rmSync(
        tmpProjPath(
          `RidApp/bin/${msbuildConfiguration}/net8.0/linux-x64/publish`
        ),
        { recursive: true, force: true }
      );
      runCommand(
        `dotnet publish RidApp/RidApp.csproj --no-build --no-restore --framework net8.0 --runtime linux-x64 --configuration ${msbuildConfiguration}`
      );
      expect(runCommand(`dotnet ${published}`).trim()).toBe('rid-variant');
      expect(readFileSync(`${sibling}/sentinel`, 'utf8')).toBe('keep-sibling');
      expect(readFileSync(tmpProjPath(other), 'utf8')).toBe(
        'keep-configuration'
      );
      expect(
        existsSync(
          tmpProjPath(
            `RidApp/bin/${msbuildConfiguration}/net8.0/win-x64/RidApp.dll`
          )
        )
      ).toBe(false);
    }
  );

  it.each([
    { ridVariants: false },
    { tfmVariants: false, ridVariants: true },
    { build: false },
  ])('honors explicit opt-outs (%j)', (options) => {
    try {
      setOptions(options);
      const project: ProjectConfiguration = JSON.parse(
        runCLI('show project RidApp --json')
      );
      expect(
        Object.keys(project.targets!).filter((name) =>
          name.includes('linux-x64')
        )
      ).toEqual([]);
    } finally {
      setOptions({});
    }
  });

  it('disables RID publishing without disabling explicit RID builds', () => {
    try {
      setOptions({ publish: false });
      const project: ProjectConfiguration = JSON.parse(
        runCLI('show project RidApp --json')
      );
      expect(project.targets!['build:net8.0:linux-x64']).toBeDefined();
      expect(project.targets!['publish:net8.0:linux-x64']).toBeUndefined();
    } finally {
      setOptions({});
    }
  });

  it('keeps ordinary custom command arguments when TFM opt-out also suppresses RID variants', () => {
    try {
      setOptions({
        tfmVariants: false,
        ridVariants: true,
        build: {
          command:
            'node -e "console.log(JSON.stringify(process.argv.slice(1)));console.log(\'env=\'+process.env.NX_PROOF_CUSTOM)" --',
          options: { args: ['--probe'], env: { NX_PROOF_CUSTOM: 'base' } },
          configurations: {
            production: {
              args: ['--production-probe'],
              env: { NX_PROOF_CUSTOM: 'production' },
            },
          },
        },
      });
      const project: ProjectConfiguration = JSON.parse(
        runCLI('show project RidApp --json')
      );

      expect(project.targets!['build:net8.0:linux-x64']).toBeUndefined();
      expect(project.targets!.build.options!.args).toEqual(['--probe']);
      expect(project.targets!.build.configurations!.production.args).toEqual([
        '--production-probe',
      ]);
      const ordinaryDefault = runCLI('run RidApp:build');
      expect(ordinaryDefault).toContain('["--probe"]');
      expect(ordinaryDefault).toContain('env=base');
      const ordinaryProduction = runCLI(
        'run RidApp:build --configuration=production'
      );
      expect(ordinaryProduction).toContain('["--production-probe"]');
      expect(ordinaryProduction).toContain('env=production');
    } finally {
      setOptions({});
    }
  });

  it('keeps dimensions and Release defaults when base targets are renamed and customized', () => {
    try {
      setOptions({
        build: {
          targetName: 'compile',
          options: { args: ['--verbosity', 'minimal'] },
          configurations: { release: { args: ['--nologo'] } },
        },
        publish: { targetName: 'deploy' },
      });
      const project: ProjectConfiguration = JSON.parse(
        runCLI('show project RidApp --json')
      );
      const build = project.targets!['compile:net8.0:linux-x64'];
      const publish = project.targets!['deploy:net8.0:linux-x64'];

      expect(build.defaultConfiguration).toBe('release');
      expect(publish.defaultConfiguration).toBe('release');
      expect(publish.dependsOn).toEqual(['compile:net8.0:linux-x64']);
      expect(build.configurations!.release.nxArgs).toBe(
        '--no-restore --framework net8.0 --runtime linux-x64 --configuration Release --verbosity minimal --nologo'
      );
      expect(build.metadata!.variantOf).toBe('compile');
      expect(publish.metadata!.variantOf).toBe('deploy');
      runCLI('run RidApp:deploy:net8.0:linux-x64');
      expect(
        runCommand(
          'dotnet RidApp/bin/Release/net8.0/linux-x64/publish/RidApp.dll'
        ).trim()
      ).toBe('rid-variant');
    } finally {
      setOptions({});
    }
  });

  it('invalidates a RID publish when a compatible dependency changes a linked source', () => {
    runCLI('run RidApp:publish:net8.0:linux-x64');
    updateFile(
      'Shared/Version.cs',
      'namespace Shared { public static class Version { public const string Value = "rid-updated"; } }'
    );

    runCLI('run RidApp:publish:net8.0:linux-x64');

    expect(
      runCommand(
        'dotnet RidApp/bin/Release/net8.0/linux-x64/publish/RidApp.dll'
      ).trim()
    ).toBe('rid-updated');
    updateFile(
      'Shared/Version.cs',
      'namespace Shared { public static class Version { public const string Value = "rid-variant"; } }'
    );
    runCLI('run RidApp:publish:net8.0:linux-x64');
    expect(
      runCommand(
        'dotnet RidApp/bin/Release/net8.0/linux-x64/publish/RidApp.dll'
      ).trim()
    ).toBe('rid-variant');
  });
});
