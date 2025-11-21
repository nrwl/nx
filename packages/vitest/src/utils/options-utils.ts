import {
  ExecutorContext,
  joinPathFragments,
  parseTargetString,
  readTargetOptions,
  workspaceRoot,
} from '@nx/devkit';
import { existsSync } from 'fs';

/**
 * Returns the path to the vite config file or undefined when not found.
 */
export function normalizeViteConfigFilePath(
  contextRoot: string,
  projectRoot: string,
  configFile?: string
): string | undefined {
  if (configFile) {
    const normalized = joinPathFragments(contextRoot, configFile);
    if (!existsSync(normalized)) {
      throw new Error(
        `Could not find vite config at provided path "${normalized}".`
      );
    }
    return normalized;
  }

  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (
      existsSync(
        joinPathFragments(contextRoot, projectRoot, `vite.config.${ext}`)
      )
    ) {
      return joinPathFragments(contextRoot, projectRoot, `vite.config.${ext}`);
    } else if (
      existsSync(
        joinPathFragments(contextRoot, projectRoot, `vitest.config.${ext}`)
      )
    ) {
      return joinPathFragments(
        contextRoot,
        projectRoot,
        `vitest.config.${ext}`
      );
    }
  }
}

export function getProjectTsConfigPath(
  projectRoot: string
): string | undefined {
  return existsSync(
    joinPathFragments(workspaceRoot, projectRoot, 'tsconfig.app.json')
  )
    ? joinPathFragments(projectRoot, 'tsconfig.app.json')
    : existsSync(
        joinPathFragments(workspaceRoot, projectRoot, 'tsconfig.lib.json')
      )
    ? joinPathFragments(projectRoot, 'tsconfig.lib.json')
    : existsSync(joinPathFragments(workspaceRoot, projectRoot, 'tsconfig.json'))
    ? joinPathFragments(projectRoot, 'tsconfig.json')
    : undefined;
}

export function getNxTargetOptions(target: string, context: ExecutorContext) {
  const targetObj = parseTargetString(target, context);
  return readTargetOptions(targetObj, context);
}
