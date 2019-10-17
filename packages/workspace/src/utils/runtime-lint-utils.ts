import * as path from 'path';
import { Dependency, DependencyType } from '../command-line/deps-calculator';
import { normalizedProjectRoot, ProjectNode } from '../command-line/shared';
import { normalize } from '@angular-devkit/core';

export type Deps = { [projectName: string]: Dependency[] };
export type DepConstraint = {
  sourceTag: string;
  onlyDependOnLibsWithTags: string[];
};

export function hasNoneOfTheseTags(proj: ProjectNode, tags: string[]) {
  return tags.filter(allowedTag => hasTag(proj, allowedTag)).length === 0;
}

function hasTag(proj: ProjectNode, tag: string) {
  return (proj.tags || []).indexOf(tag) > -1 || tag === '*';
}

function containsFile(
  files: string[],
  targetFileWithoutExtension: string
): boolean {
  return !!files.filter(f => removeExt(f) === targetFileWithoutExtension)[0];
}

function removeExt(file: string): string {
  return file.replace(/\.[^/.]+$/, '');
}

function removeWindowsDriveLetter(osSpecificPath: string): string {
  return osSpecificPath.replace(/^[A-Z]:/, '');
}

function normalizePath(osSpecificPath: string): string {
  return removeWindowsDriveLetter(osSpecificPath)
    .split(path.sep)
    .join('/');
}

export function matchImportWithWildcard(
  // This may or may not contain wildcards ("*")
  allowableImport: string,
  extractedImport: string
): boolean {
  if (allowableImport.endsWith('/**')) {
    const prefix = allowableImport.substring(0, allowableImport.length - 2);
    return extractedImport.startsWith(prefix);
  } else if (allowableImport.endsWith('/*')) {
    const prefix = allowableImport.substring(0, allowableImport.length - 1);
    if (!extractedImport.startsWith(prefix)) return false;
    return extractedImport.substring(prefix.length).indexOf('/') > -1;
  } else if (allowableImport.indexOf('/**/') > -1) {
    const [prefix, suffix] = allowableImport.split('/**/');
    return (
      extractedImport.startsWith(prefix) && extractedImport.endsWith(suffix)
    );
  } else {
    return new RegExp(allowableImport).test(extractedImport);
  }
}

export function isRelative(s: string) {
  return s.startsWith('.');
}

export function isRelativeImportIntoAnotherProject(
  imp: string,
  projectPath: string,
  projectNodes: ProjectNode[],
  sourceFilePath: string
): boolean {
  if (!isRelative(imp)) return false;

  const targetFile = normalizePath(
    path.resolve(path.join(projectPath, path.dirname(sourceFilePath)), imp)
  ).substring(projectPath.length + 1);

  const sourceProject = findSourceProject(projectNodes, sourceFilePath);
  const targetProject = findTargetProject(projectNodes, targetFile);
  return sourceProject && targetProject && sourceProject !== targetProject;
}

export function findProjectUsingFile(
  projectNodes: ProjectNode[],
  file: string
) {
  return projectNodes.filter(n => containsFile(n.files, file))[0];
}

export function findSourceProject(
  projectNodes: ProjectNode[],
  sourceFilePath: string
) {
  const targetFile = removeExt(sourceFilePath);
  return findProjectUsingFile(projectNodes, targetFile);
}

export function findTargetProject(
  projectNodes: ProjectNode[],
  targetFile: string
) {
  let targetProject = findProjectUsingFile(projectNodes, targetFile);
  if (!targetProject) {
    targetProject = findProjectUsingFile(
      projectNodes,
      normalizePath(path.join(targetFile, 'index'))
    );
  }
  if (!targetProject) {
    targetProject = findProjectUsingFile(
      projectNodes,
      normalizePath(path.join(targetFile, 'src', 'index'))
    );
  }
  return targetProject;
}

export function isAbsoluteImportIntoAnotherProject(imp: string) {
  return (
    imp.startsWith('libs/') ||
    imp.startsWith('/libs/') ||
    imp.startsWith('apps/') ||
    imp.startsWith('/apps/')
  );
}

export function findProjectUsingImport(
  projectNodes: ProjectNode[],
  npmScope: string,
  imp: string
) {
  const unscopedImport = imp.substring(npmScope.length + 2);
  return projectNodes.filter(n => {
    const normalizedRoot = normalizedProjectRoot(n);
    return (
      unscopedImport === normalizedRoot ||
      unscopedImport.startsWith(`${normalizedRoot}/`)
    );
  })[0];
}

export function isCircular(
  deps: Deps,
  sourceProject: ProjectNode,
  targetProject: ProjectNode
): boolean {
  if (!deps[targetProject.name]) return false;
  return isDependingOn(deps, targetProject.name, sourceProject.name);
}

function isDependingOn(
  deps: Deps,
  sourceProjectName: string,
  targetProjectName: string,
  done: { [projectName: string]: boolean } = {}
): boolean {
  if (done[sourceProjectName]) return false;
  if (!deps[sourceProjectName]) return false;
  return deps[sourceProjectName]
    .map(dep =>
      dep.projectName === targetProjectName
        ? true
        : isDependingOn(deps, dep.projectName, targetProjectName, {
            ...done,
            [`${sourceProjectName}`]: true
          })
    )
    .some(result => result);
}

export function findConstraintsFor(
  depConstraints: DepConstraint[],
  sourceProject: ProjectNode
) {
  return depConstraints.filter(f => hasTag(sourceProject, f.sourceTag));
}

export function onlyLoadChildren(
  deps: Deps,
  sourceProjectName: string,
  targetProjectName: string,
  visited: string[]
) {
  if (visited.indexOf(sourceProjectName) > -1) return false;
  return (
    (deps[sourceProjectName] || []).filter(d => {
      if (d.type !== DependencyType.loadChildren) return false;
      if (d.projectName === targetProjectName) return true;
      return onlyLoadChildren(deps, d.projectName, targetProjectName, [
        ...visited,
        sourceProjectName
      ]);
    }).length > 0
  );
}

export function getSourceFilePath(sourceFileName: string, projectPath: string) {
  return normalize(sourceFileName).substring(projectPath.length + 1);
}
