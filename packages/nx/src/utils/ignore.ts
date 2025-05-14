import ignore from 'ignore';
import { readFileIfExisting } from './fileutils';
import { workspaceRoot } from './workspace-root';

export function getIgnoreObject(
  root: string = workspaceRoot
): ReturnType<typeof ignore> {
  const ig = ignore();
  ig.add(readFileIfExisting(`${root}/.gitignore`));
  ig.add(readFileIfExisting(`${root}/.nxignore`));
  return ig;
}
