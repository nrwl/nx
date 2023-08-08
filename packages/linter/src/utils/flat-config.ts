import { joinPathFragments, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs';

export function useFlatConfig(): boolean {
  return existsSync(joinPathFragments(workspaceRoot, 'eslint.config.js'));
}
