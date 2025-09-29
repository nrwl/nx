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
