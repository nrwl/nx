import type { ExecutorContext, ProjectGraphProjectNode } from '@nrwl/devkit';
import { logger, readJsonFile } from '@nrwl/devkit';
import type { TypeScriptCompilationOptions } from '@nrwl/workspace/src/utilities/typescript/compilation';
import {
  copySync,
  readdirSync,
  readFileSync,
  removeSync,
  writeFileSync,
} from 'fs-extra';
import { join, relative } from 'path';
import type { NormalizedExecutorOptions } from './schema';

export function handleInliningBuild(
  context: ExecutorContext,
  options: NormalizedExecutorOptions,
  tsConfigPath: string
): Array<ProjectGraphProjectNode & { pathAlias: string }> {
  const projectDependencies =
    context.projectGraph.dependencies[context.projectName];
  const dependencies: Array<{ name: string; path: string }> = [];

  if (projectDependencies && projectDependencies.length) {
    const tsConfigJson = readJsonFile(tsConfigPath);

    // handle inlining
    // 1. figure out a list of dependencies that need to be inlined
    for (const projectDependency of projectDependencies) {
      // skip npm packages
      if (projectDependency.target.startsWith('npm')) {
        continue;
      }

      let shouldInline = false;
      if (options.external === 'all') {
        /**
         * if all buildable libraries are marked as external,
         * then push the project dependency that doesn't have a build target
         */
        if (!hasBuildTarget(projectDependency.target, context, options)) {
          shouldInline = true;
        }
      } else if (options.external === 'none') {
        /**
         * if all buildable libraries are marked as internal,
         * then push every project dependency to be inlined
         */
        shouldInline = true;
      }

      if (shouldInline) {
        dependencies.push({
          name: projectDependency.target,
          path: getPathAliasForPackage(
            context.projectGraph.nodes[projectDependency.target],
            tsConfigJson['compilerOptions']['paths']
          ),
        });
      }
    }

    // 2. adjust rootDir of tmp tsConfig if we have dependencies to inline
    if (dependencies.length > 0) {
      logger.log(
        'List of dependencies to be inlined:',
        JSON.stringify(dependencies, null, 2)
      );
    }
  }
  return dependencies.map((dependency) => ({
    ...context.projectGraph.nodes[dependency.name],
    pathAlias: dependency.path,
  }));
}

export function postProcessInlinedDependencies(
  tsCompilationOptions: TypeScriptCompilationOptions,
  inlinedDependencies: Array<ProjectGraphProjectNode & { pathAlias: string }>
) {
  if (inlinedDependencies.length === 0) {
    return;
  }

  const destOutputPath = tsCompilationOptions.outputPath;
  const parentLibDir = tsCompilationOptions.projectRoot;

  const parentOutputPath = join(destOutputPath, parentLibDir);

  // move parentOutput
  movePackage(parentOutputPath, destOutputPath);

  const inlinedDepsDestOutputRecord: Record<string, string> = {};
  // move inlined outputs
  for (const inlinedDependency of inlinedDependencies) {
    const depOutputPath = join(destOutputPath, inlinedDependency.data.root);
    const destDepOutputPath = join(destOutputPath, inlinedDependency.name);
    movePackage(depOutputPath, destDepOutputPath);

    // TODO: hard-coded "src"
    inlinedDepsDestOutputRecord[inlinedDependency.pathAlias] =
      destDepOutputPath + '/src';
  }

  updateImports(destOutputPath, inlinedDepsDestOutputRecord);
}

function movePackage(from: string, to: string) {
  copySync(from, to, { overwrite: true, recursive: true });
  removeSync(from);
}

function updateImports(
  destOutputPath: string,
  inlinedDepsDestOutputRecord: Record<string, string>
) {
  const importRegex = new RegExp(
    Object.keys(inlinedDepsDestOutputRecord).join('|'),
    'g'
  );
  recursiveUpdateImport(
    destOutputPath + '/src',
    importRegex,
    inlinedDepsDestOutputRecord
  );
}

function recursiveUpdateImport(
  dirPath: string,
  importRegex: RegExp,
  inlinedDepsDestOutputRecord: Record<string, string>
) {
  const files = readdirSync(dirPath, { withFileTypes: true });
  for (const file of files) {
    // only check .js and .d.ts files
    if (
      file.isFile() &&
      (file.name.endsWith('.js') || file.name.endsWith('.d.ts'))
    ) {
      const filePath = join(dirPath, file.name);
      const fileContent = readFileSync(filePath, 'utf-8');
      const updatedContent = fileContent.replace(importRegex, (matched) =>
        relative(dirPath, inlinedDepsDestOutputRecord[matched])
      );
      writeFileSync(filePath, updatedContent);
    } else if (file.isDirectory()) {
      recursiveUpdateImport(
        join(dirPath, file.name),
        importRegex,
        inlinedDepsDestOutputRecord
      );
    }
  }
}

function getPathAliasForPackage(
  packageNode: ProjectGraphProjectNode,
  pathAliases: Record<string, string[]>
): string {
  if (!packageNode) return '';

  for (const [alias, paths] of Object.entries(pathAliases)) {
    if (paths.some((path) => path.includes(packageNode.data.root))) {
      return alias;
    }
  }

  return '';
}

function hasBuildTarget(
  projectName: string,
  context: ExecutorContext,
  options: NormalizedExecutorOptions
): boolean {
  return options.externalBuildTargets.some(
    (buildTarget) =>
      context.projectGraph.nodes[projectName]?.data?.targets?.[buildTarget]
  );
}
