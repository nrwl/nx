import { joinPathFragments, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs';

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
      : existsSync(
            joinPathFragments(workspaceRoot, projectRoot, 'tsconfig.json')
          )
        ? joinPathFragments(projectRoot, 'tsconfig.json')
        : undefined;
}
