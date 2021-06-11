import { join } from 'path';

export const archiveRootPath = join(
  process.env.WORKSPACE_ROOT,
  'nx-dev/nx-dev/public/documentation'
);
export const previewRootPath = join(process.env.WORKSPACE_ROOT, 'docs');

export function extractTitle(markdownContent: string): string | null {
  return (
    /^\s*#\s+(?<title>.+)[\n.]+/.exec(markdownContent)?.groups.title ?? null
  );
}
