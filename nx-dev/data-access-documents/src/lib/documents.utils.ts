import { join } from 'path';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';

export const archiveRootPath = join(appRootPath, 'nx-dev/archive');
export const previewRootPath = join(appRootPath, 'docs');

export function extractTitle(markdownContent: string): string | null {
  return (
    /^\s*#\s+(?<title>.+)[\n.]+/.exec(markdownContent)?.groups.title ?? null
  );
}
