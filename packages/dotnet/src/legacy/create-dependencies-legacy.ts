import { dirname, join, parse, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';

import {
  CreateDependencies,
  DependencyType,
  normalizePath,
  ProjectConfiguration,
  RawProjectGraphDependency,
} from '@nx/devkit';

import { DotNetPluginOptions } from './create-nodes-legacy';

// Dependency Detection Implementation

interface DotNetClient {
  getProjectReferencesAsync(projectFile: string): Promise<string[]>;
}

class NativeDotNetClient implements DotNetClient {
  constructor(private workspaceRoot: string) {}

  async getProjectReferencesAsync(projectFile: string): Promise<string[]> {
    const output = execSync(`dotnet list "${projectFile}" reference`, {
      cwd: this.workspaceRoot,
      encoding: 'utf8',
      windowsHide: true,
    });

    return output
      .split('\n')
      .slice(2) // Skip header lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
}

function createProjectRootMappings(
  projects: Record<string, ProjectConfiguration>
): Record<string, string> {
  const rootMap: Record<string, string> = {};
  for (const [, project] of Object.entries(projects)) {
    if (project.root && project.name) {
      rootMap[project.root] = project.name;
    }
  }
  return rootMap;
}

function findProjectForPath(
  filePath: string,
  rootMap: Record<string, string>
): string | undefined {
  let currentPath = normalizePath(filePath);

  for (
    ;
    currentPath !== dirname(currentPath);
    currentPath = dirname(currentPath)
  ) {
    const project = rootMap[currentPath];
    if (project) {
      return project;
    }
  }

  return rootMap[currentPath];
}

function resolveReferenceToProject(
  reference: string,
  sourceFile: string,
  rootMap: Record<string, string>,
  workspaceRoot: string
): string | undefined {
  const resolved = resolve(workspaceRoot, dirname(sourceFile), reference);
  const relativePath = relative(workspaceRoot, resolved);
  return findProjectForPath(relativePath, rootMap);
}

export const createDependenciesLegacy: CreateDependencies<
  DotNetPluginOptions
> = async (_, ctx) => {
  const dependencies: RawProjectGraphDependency[] = [];

  const rootMap = createProjectRootMappings(ctx.projects);

  // Use dotnet CLI for dependency detection
  const dotnetClient = new NativeDotNetClient(ctx.workspaceRoot);

  for (const [source] of Object.entries(ctx.projects)) {
    const files = ctx.filesToProcess.projectFileMap[source] || [];

    for (const file of files) {
      const { ext } = parse(file.file);
      if (['.csproj', '.fsproj', '.vbproj'].includes(ext)) {
        const references = await dotnetClient.getProjectReferencesAsync(
          join(ctx.workspaceRoot, file.file)
        );

        for (const reference of references) {
          const target = resolveReferenceToProject(
            reference,
            file.file,
            rootMap,
            ctx.workspaceRoot
          );
          if (target) {
            dependencies.push({
              source,
              target,
              type: DependencyType.static,
              sourceFile: file.file,
            });
          }
        }
      }
    }
  }

  return dependencies;
};
