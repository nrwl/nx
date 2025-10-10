import { dirname, relative, resolve, normalize } from 'node:path';
import { ProjectConfiguration, normalizePath } from '@nx/devkit';
import { verboseLog } from './logger';

export function createProjectRootMappings(
  projects: Record<string, ProjectConfiguration>
): Record<string, string> {
  const rootMap: Record<string, string> = {};
  verboseLog('[dotnet-deps] Creating project root mappings');
  for (const [, project] of Object.entries(projects)) {
    if (project.root && project.name) {
      rootMap[project.root] = project.name;
      verboseLog(`[dotnet-deps]   Mapping: ${project.root} -> ${project.name}`);
    }
  }
  verboseLog(`[dotnet-deps] Created ${Object.keys(rootMap).length} mappings`);
  return rootMap;
}

export function findProjectForPath(
  filePath: string,
  rootMap: Record<string, string>
): string | undefined {
  let currentPath = normalizePath(filePath);
  verboseLog(`[dotnet-deps] Finding project for path: ${filePath}`);
  verboseLog(`[dotnet-deps]   Normalized path: ${currentPath}`);

  const checkedPaths: string[] = [];
  for (
    ;
    currentPath !== dirname(currentPath);
    currentPath = dirname(currentPath)
  ) {
    checkedPaths.push(currentPath);
    const project = rootMap[currentPath];
    if (project) {
      verboseLog(`[dotnet-deps]   Found project: ${project} at ${currentPath}`);
      return project;
    }
  }

  const result = rootMap[currentPath];
  checkedPaths.push(currentPath);
  verboseLog(`[dotnet-deps]   Checked paths: ${checkedPaths.join(' -> ')}`);
  verboseLog(`[dotnet-deps]   Result: ${result || 'NOT FOUND'}`);
  return result;
}

export function resolveReferenceToProject(
  reference: string,
  sourceFile: string,
  rootMap: Record<string, string>,
  workspaceRoot: string
): string | undefined {
  verboseLog(`[dotnet-deps] Resolving reference to project:`);
  verboseLog(`[dotnet-deps]   Reference: ${reference}`);
  verboseLog(`[dotnet-deps]   Source file: ${sourceFile}`);
  verboseLog(`[dotnet-deps]   Workspace root: ${workspaceRoot}`);

  const resolved = resolve(workspaceRoot, dirname(sourceFile), reference);
  verboseLog(`[dotnet-deps]   Resolved absolute path: ${resolved}`);

  const relativePath = relative(workspaceRoot, resolved);
  verboseLog(`[dotnet-deps]   Relative path (raw): ${relativePath}`);

  // First normalize path separators (backslashes to forward slashes)
  // Then resolve .. segments
  const pathWithForwardSlashes = normalizePath(relativePath);
  verboseLog(
    `[dotnet-deps]   Path with forward slashes: ${pathWithForwardSlashes}`
  );

  const normalizedRelativePath = normalize(pathWithForwardSlashes);
  verboseLog(
    `[dotnet-deps]   Relative path (normalized): ${normalizedRelativePath}`
  );

  const result = findProjectForPath(normalizedRelativePath, rootMap);
  verboseLog(
    `[dotnet-deps]   Final resolved project: ${result || 'NOT FOUND'}`
  );

  return result;
}
