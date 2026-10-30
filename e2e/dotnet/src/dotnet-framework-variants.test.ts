import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCommand,
  tmpProjPath,
  updateFile,
} from '@nx/e2e-utils';
import { existsSync, readFileSync, rmSync } from 'node:fs';

describe('.NET framework variant execution and caching', () => {
  beforeAll(() => {
    newProject({ packages: [] });
    runCLI('add @nx/dotnet');
    updateFile('.gitignore', (content) => `${content}\nbin/\nobj/\nproof/\n`);
    updateFile(
      'Common/Common.csproj',
      `<Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup><TargetFramework>netstandard2.1</TargetFramework></PropertyGroup>
        <ItemGroup><Compile Include="../Shared/Linked.cs" Link="Linked.cs" /></ItemGroup>
      </Project>`
    );
    updateFile('Shared/Linked.cs', 'public class Linked {}');
    updateFile(
      'Debug/App/App.csproj',
      `<Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup>
          <TargetFrameworks>net8.0;netstandard2.1</TargetFrameworks>
          <RuntimeIdentifiers>linux-x64;win-x64</RuntimeIdentifiers>
        </PropertyGroup>
        <ItemGroup><ProjectReference Include="../../Common/Common.csproj" /></ItemGroup>
        <ItemGroup Condition="'$(TargetFramework)' == 'net8.0'"><Compile Remove="Portable.cs" /></ItemGroup>
        <ItemGroup Condition="'$(TargetFramework)' == 'netstandard2.1'"><Compile Remove="Modern.cs" /></ItemGroup>
      </Project>`
    );
    updateFile('Debug/App/Shared.cs', 'public class Shared {}');
    updateFile('Debug/App/Modern.cs', 'public class Modern {}');
    updateFile('Debug/App/Portable.cs', 'public class Portable {}');
    updateFile(
      'Directory.Build.targets',
      `<Project><Target Name="RecordNxProof" AfterTargets="Build">
        <MakeDir Directories="$(MSBuildThisFileDirectory)proof" />
        <WriteLinesToFile File="$(MSBuildThisFileDirectory)proof/$(MSBuildProjectName)-$(TargetFramework)-$(Configuration).txt" Lines="$(NX_TASK_HASH)" Overwrite="false" />
      </Target></Project>`
    );
    runCommand('dotnet restore Debug/App/App.csproj');
  });

  afterAll(() => cleanupProject());

  it('isolates sources, restores the compatible reference closure, and schedules Release leaves', () => {
    const proof = (tfm: string, configuration = 'Debug') =>
      readFileSync(
        tmpProjPath(`proof/App-${tfm}-${configuration}.txt`),
        'utf8'
      );
    updateFile('Debug/App/bin/Debug/net8.0/linux-x64/sentinel.txt', 'original');
    runCLI('build App');
    const modern = proof('net8.0');
    const portable = proof('netstandard2.1');
    updateFile(
      'Debug/App/bin/Debug/net8.0/linux-x64/sentinel.txt',
      'preserved'
    );
    rmSync(tmpProjPath('Debug/App/bin/Debug/net8.0/App.dll'));
    rmSync(tmpProjPath('Common/bin/Debug/netstandard2.1'), { recursive: true });
    rmSync(tmpProjPath('Common/obj/Debug/netstandard2.1'), { recursive: true });
    runCLI('build App');
    expect(proof('net8.0')).toBe(modern);
    expect(proof('netstandard2.1')).toBe(portable);
    expect(existsSync(tmpProjPath('Debug/App/bin/Debug/net8.0/App.dll'))).toBe(
      true
    );
    expect(
      existsSync(tmpProjPath('Common/bin/Debug/netstandard2.1/Common.dll'))
    ).toBe(true);
    expect(
      readFileSync(
        tmpProjPath('Debug/App/bin/Debug/net8.0/linux-x64/sentinel.txt'),
        'utf8'
      )
    ).toBe('preserved');

    updateFile(
      'Debug/App/Modern.cs',
      'public class Modern { public int Changed; }'
    );
    runCLI('build App');
    expect(proof('net8.0')).not.toBe(modern);
    expect(proof('netstandard2.1')).toBe(portable);
    const changedModern = proof('net8.0');
    updateFile(
      'Shared/Linked.cs',
      'public class Linked { public int Changed; }'
    );
    runCLI('build App');
    expect(proof('net8.0')).not.toBe(changedModern);
    expect(proof('netstandard2.1')).not.toBe(portable);

    runCLI('run App:build --configuration=release --graph=release-tasks.json');
    const graph = readJson('release-tasks.json').tasks;
    expect(Object.keys(graph.tasks).sort()).toEqual([
      'App:build:net8.0:release',
      'App:build:netstandard2.1:release',
      'App:build:release',
    ]);
    runCLI('run App:build --configuration=release');
    const release = proof('net8.0', 'Release');
    rmSync(tmpProjPath('Debug/App/bin/Release/net8.0/App.dll'));
    runCLI('run App:build --configuration=release');
    expect(proof('net8.0', 'Release')).toBe(release);
    expect(
      existsSync(tmpProjPath('Debug/App/bin/Release/net8.0/App.dll'))
    ).toBe(true);
  });
});
