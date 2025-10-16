import {
  e2eConsoleLogger,
  isWindows,
  runCommand,
  tmpProjPath,
} from '@nx/e2e-utils';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs-extra';
import { join } from 'path';

export interface DotNetProjectOptions {
  name: string;
  type: 'console' | 'classlib' | 'xunit' | 'webapi';
  cwd?: string;
}

export function createDotNetProject({
  name,
  type,
  cwd = tmpProjPath(),
}: DotNetProjectOptions) {
  e2eConsoleLogger(`Creating .NET ${type} project: ${name}`);

  // Check if .NET CLI is available
  try {
    e2eConsoleLogger(`Using dotnet version: ${execSync('dotnet --version')}`);
  } catch (error) {
    throw new Error(
      '.NET CLI is not available. Please install .NET 8.0 or later.'
    );
  }

  // Create the project
  const projectPath = join(cwd, name);
  e2eConsoleLogger(
    runCommand(`dotnet new ${type} -n ${name}`, {
      cwd,
    })
  );

  return projectPath;
}

export function createDotNetSolution(
  solutionName: string,
  projects: DotNetProjectOptions[],
  cwd: string = tmpProjPath()
) {
  e2eConsoleLogger(`Creating .NET solution: ${solutionName}`);

  // Create solution
  runCommand(`dotnet new sln -n ${solutionName}`, { cwd });

  const projectPaths: string[] = [];

  // Create each project
  for (const project of projects) {
    const projectPath = createDotNetProject({
      ...project,
      cwd,
    });
    projectPaths.push(projectPath);

    // Add project to solution
    runCommand(
      `dotnet sln ${solutionName}.sln add ${project.name}/${project.name}.csproj`,
      { cwd }
    );
  }

  return { solutionPath: join(cwd, `${solutionName}.sln`), projectPaths };
}

export function addProjectReference(
  fromProject: string,
  toProject: string,
  cwd: string = tmpProjPath()
) {
  e2eConsoleLogger(
    `Adding project reference from ${fromProject} to ${toProject}`
  );
  runCommand(
    `dotnet add ${fromProject}/${fromProject}.csproj reference ${toProject}/${toProject}.csproj`,
    { cwd }
  );
}

export function addPackageReference(
  project: string,
  packageName: string,
  version?: string,
  cwd: string = tmpProjPath()
) {
  e2eConsoleLogger(`Adding package ${packageName} to ${project}`);
  const versionFlag = version ? `--version ${version}` : '';
  runCommand(
    `dotnet add ${project}/${project}.csproj package ${packageName} ${versionFlag}`,
    { cwd }
  );
}

// Pre-defined project templates for common scenarios
export function createSimpleDotNetWorkspace(cwd: string = tmpProjPath()) {
  return createDotNetSolution(
    'MyWorkspace',
    [
      { name: 'MyApp', type: 'console' },
      { name: 'MyLibrary', type: 'classlib' },
      { name: 'MyApp.Tests', type: 'xunit' },
    ],
    cwd
  );
}

export function createWebApiWorkspace(cwd: string = tmpProjPath()) {
  const result = createDotNetSolution(
    'WebApiWorkspace',
    [
      { name: 'WebApi', type: 'webapi' },
      { name: 'Core', type: 'classlib' },
      { name: 'Core.Tests', type: 'xunit' },
      { name: 'WebApi.Tests', type: 'xunit' },
    ],
    cwd
  );

  // Add project references
  addProjectReference('WebApi', 'Core', cwd);
  addProjectReference('Core.Tests', 'Core', cwd);
  addProjectReference('WebApi.Tests', 'WebApi', cwd);

  // Add common test packages
  addPackageReference('Core.Tests', 'FluentAssertions', cwd);
  addPackageReference('WebApi.Tests', 'Microsoft.AspNetCore.Mvc.Testing', cwd);

  return result;
}

export function updateProjectFile(
  projectName: string,
  updates: (content: string) => string,
  cwd: string = tmpProjPath()
) {
  const projectPath = join(cwd, projectName, `${projectName}.csproj`);
  const content = require('fs').readFileSync(projectPath, 'utf-8');
  const updatedContent = updates(content);
  writeFileSync(projectPath, updatedContent);
}

export function enableArtifactsOutput(
  artifactsPath: string = 'artifacts',
  cwd: string = tmpProjPath()
) {
  e2eConsoleLogger(`Enabling artifacts output with path: ${artifactsPath}`);
  const directoryBuildPropsPath = join(cwd, 'Directory.Build.props');
  writeFileSync(
    directoryBuildPropsPath,
    `<Project>
  <PropertyGroup>
    <UseArtifactsOutput>true</UseArtifactsOutput>
    <ArtifactsPath>${artifactsPath}</ArtifactsPath>
  </PropertyGroup>
</Project>`
  );
}

export function setCustomPivot(
  projectName: string,
  pivot: string,
  cwd: string = tmpProjPath()
) {
  e2eConsoleLogger(`Setting custom pivot for ${projectName}: ${pivot}`);
  updateProjectFile(
    projectName,
    (content) =>
      content.replace(
        '</PropertyGroup>',
        `  <ArtifactsPivots>${pivot}</ArtifactsPivots>\n</PropertyGroup>`
      ),
    cwd
  );
}

export function enableMultiTargeting(
  projectName: string,
  targetFrameworks: string[],
  cwd: string = tmpProjPath()
) {
  e2eConsoleLogger(
    `Enabling multi-targeting for ${projectName}: ${targetFrameworks.join(
      ', '
    )}`
  );
  updateProjectFile(
    projectName,
    (content) =>
      content.replace(
        /<TargetFramework>.*?<\/TargetFramework>/,
        `<TargetFrameworks>${targetFrameworks.join(';')}</TargetFrameworks>`
      ),
    cwd
  );
}

export function setCustomOutputPath(
  projectName: string,
  outputPath: string,
  intermediatePath?: string,
  cwd: string = tmpProjPath()
) {
  e2eConsoleLogger(
    `Setting custom output path for ${projectName}: ${outputPath}`
  );
  updateProjectFile(
    projectName,
    (content) => {
      let updated = content.replace(
        '</PropertyGroup>',
        `  <OutputPath>${outputPath}</OutputPath>\n</PropertyGroup>`
      );
      if (intermediatePath) {
        updated = updated.replace(
          '</PropertyGroup>',
          `  <IntermediateOutputPath>${intermediatePath}</IntermediateOutputPath>\n</PropertyGroup>`
        );
      }
      return updated;
    },
    cwd
  );
}
