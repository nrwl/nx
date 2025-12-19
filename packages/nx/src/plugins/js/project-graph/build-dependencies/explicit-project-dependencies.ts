import { join, relative } from 'path';
import { DependencyType } from '../../../../config/project-graph';
import { ProjectConfiguration } from '../../../../config/workspace-json-project-json';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import {
  RawProjectGraphDependency,
  validateDependency,
} from '../../../../project-graph/project-graph-builder';
import { normalizePath } from '../../../../utils/path';
import { workspaceRoot } from '../../../../utils/workspace-root';
import { TargetProjectLocator } from './target-project-locator';

function isRoot(
  projects: Record<string, ProjectConfiguration>,
  projectName: string
): boolean {
  return projects[projectName]?.root === '.';
}

function convertImportToDependency(
  importExpr: string,
  sourceFile: string,
  source: string,
  type: RawProjectGraphDependency['type'],
  targetProjectLocator: TargetProjectLocator
): RawProjectGraphDependency | undefined {
  const target = targetProjectLocator.findProjectFromImport(
    importExpr,
    sourceFile
  );
  if (!target) {
    return;
  }
  return {
    source,
    target,
    sourceFile,
    type,
  };
}

export function buildExplicitTypeScriptDependencies(
  ctx: CreateDependenciesContext,
  targetProjectLocator: TargetProjectLocator
): RawProjectGraphDependency[] {
  const res: RawProjectGraphDependency[] = [];

  const filesToProcess: Record<string, string[]> = {};

  const moduleExtensions = [
    '.ts',
    '.js',
    '.tsx',
    '.jsx',
    '.mts',
    '.mjs',
    '.cjs',
    '.cts',
    '.vue',
  ];

  Object.keys(ctx.filesToProcess.projectFileMap).forEach((project) => {
    filesToProcess[project] ??= [];
    ctx.filesToProcess.projectFileMap[project].forEach((fileData) => {
      if (moduleExtensions.some((ext) => fileData.file.endsWith(ext))) {
        filesToProcess[project].push(join(workspaceRoot, fileData.file));
      }
    });
  });

  const { findImports } = require('../../../../native');
  // TODO(jon): check why this function is very slow and whether we it can be optimized
  const imports = findImports(filesToProcess);

  for (let i = 0; i < imports.length; i++) {
    const {
      sourceProject,
      file,
      staticImportExpressions,
      dynamicImportExpressions,
    } = imports[i];
    const normalizedFilePath = normalizePath(relative(workspaceRoot, file));

    for (const importExpr of staticImportExpressions) {
      const dependency = convertImportToDependency(
        importExpr,
        normalizedFilePath,
        sourceProject,
        DependencyType.static,
        targetProjectLocator
      );
      if (!dependency) {
        continue;
      }

      // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
      if (
        isRoot(ctx.projects, dependency.source) ||
        !isRoot(ctx.projects, dependency.target)
      ) {
        res.push(dependency);
      }
    }
    for (const importExpr of dynamicImportExpressions) {
      const dependency = convertImportToDependency(
        importExpr,
        normalizedFilePath,
        sourceProject,
        DependencyType.dynamic,
        targetProjectLocator
      );
      if (!dependency) {
        continue;
      }

      // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
      if (
        isRoot(ctx.projects, dependency.source) ||
        !isRoot(ctx.projects, dependency.target)
      ) {
        validateDependency(dependency, ctx);
        res.push(dependency);
      }
    }
  }

  return res;
}
