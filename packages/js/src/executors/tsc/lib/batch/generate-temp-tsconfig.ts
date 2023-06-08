import type { ExecutorContext } from '@nx/devkit';
import { joinPathFragments, normalizePath, writeJsonFile } from '@nx/devkit';
import { dirname, join, relative } from 'path';
import * as ts from 'typescript';
import type { NormalizedExecutorOptions } from '../../../../utils/schema';
import { getTaskOptions } from './get-task-options';

export function generateTempTsConfig(
  taskOptionsMap: Record<string, NormalizedExecutorOptions>,
  taskName: string,
  taskOptions: NormalizedExecutorOptions,
  context: ExecutorContext
): string {
  const tmpDir = join(context.root, 'tmp');
  const originalTsConfigPath = taskOptions.tsConfig;
  const tmpTsConfigPath = join(
    tmpDir,
    relative(context.root, originalTsConfigPath)
  );

  const projectReferences: { path: string }[] = [];
  for (const depTask of context.taskGraph.dependencies[taskName]) {
    // if included in the provided map, use it
    if (taskOptionsMap[depTask]) {
      projectReferences.push({
        path: join(
          tmpDir,
          relative(context.root, taskOptionsMap[depTask].tsConfig)
        ),
      });
      continue;
    }

    // if it's not included in the provided map, it could be a cached task and
    // we need to pull the tsconfig from the relevant project graph node
    const options = getTaskOptions(depTask, context);
    if (options.tsConfig) {
      projectReferences.push({
        path: join(tmpDir, relative(context.root, options.tsConfig)),
      });
    }
  }

  writeJsonFile(tmpTsConfigPath, {
    extends: normalizePath(
      relative(dirname(tmpTsConfigPath), taskOptions.tsConfig)
    ),
    compilerOptions: {
      rootDir: taskOptions.rootDir,
      outDir: taskOptions.outputPath,
      composite: true,
      declaration: true,
      declarationMap: true,
      tsBuildInfoFile: joinPathFragments(
        taskOptions.outputPath,
        'tsconfig.tsbuildinfo'
      ),
    },
    references: projectReferences,
  });

  /**
   * Ensure the temp tsconfig has the same modified date as the original.
   * Typescript compares this against the modified date of the tsbuildinfo
   * file. If the tsbuildinfo file is older, the cache is invalidated.
   * Since we always generate the temp tsconfig, any existing tsbuildinfo
   * file will be older even if they are not older than the original tsconfig.
   */
  ts.sys.setModifiedTime(
    tmpTsConfigPath,
    ts.sys.getModifiedTime(originalTsConfigPath)
  );

  return tmpTsConfigPath;
}
