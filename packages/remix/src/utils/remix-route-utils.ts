import { joinPathFragments, readProjectConfiguration, Tree } from '@nx/devkit';
import { relative } from 'path';
import { getRemixConfigValues } from './remix-config';

export function normalizeRoutePath(path: string) {
  return path.indexOf('/routes/') > -1
    ? path.substring(path.indexOf('/routes/') + 8)
    : path;
}

export function checkRoutePathForErrors(path: string) {
  return (
    path.match(/\w\.\.\w/) || // route.$withParams.tsx => route..tsx
    path.match(/\w\/\/\w/) || // route/$withParams/index.tsx => route//index.tsx
    path.match(/\w\/\.\w/) // route/$withParams.tsx => route/.tsx
  );
}

export async function resolveRemixAppDirectory(
  tree: Tree,
  projectName: string
) {
  const project = readProjectConfiguration(tree, projectName);
  const remixConfig = await getRemixConfigValues(tree, projectName);

  return joinPathFragments(
    project.root,
    remixConfig.appDirectory
      ? relative(project.root, remixConfig.appDirectory)
      : 'app'
  );
}
