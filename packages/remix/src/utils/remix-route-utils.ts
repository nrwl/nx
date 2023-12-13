import {
  joinPathFragments,
  names,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { getRemixConfigValues } from './remix-config';

/**
 *
 * @param tree
 * @param path to the route which could be fully specified or just "foo/bar"
 * @param projectName the name of the project where the route should be added
 * @param fileExtension the file extension to add to resolved route file
 * @returns file path to the route
 */
export async function resolveRemixRouteFile(
  tree: Tree,
  path: string,
  projectName?: string,
  fileExtension?: string
): Promise<string> {
  const { name: routePath } = names(path.replace(/^\//, '').replace(/\/$/, ''));

  if (!projectName) {
    return appendRouteFileExtension(tree, routePath, fileExtension);
  } else {
    const project = readProjectConfiguration(tree, projectName);
    if (!project) throw new Error(`Project does not exist: ${projectName}`);
    const normalizedRoutePath = normalizeRoutePath(routePath);
    const fileName = appendRouteFileExtension(
      tree,
      normalizedRoutePath,
      fileExtension
    );

    return joinPathFragments(
      await resolveRemixAppDirectory(tree, projectName),
      'routes',
      fileName
    );
  }
}

function appendRouteFileExtension(
  tree: Tree,
  routePath: string,
  fileExtension?: string
) {
  // if no file extension specified, let's try to find it
  if (!fileExtension) {
    // see if the path already has it
    const extensionMatch = routePath.match(/(\.[^.]+)$/);

    if (extensionMatch) {
      fileExtension = extensionMatch[0];
    } else {
      // look for either .ts or .tsx to exist in tree
      if (tree.exists(`${routePath}.ts`)) {
        fileExtension = '.ts';
      } else {
        // default to .tsx if nothing else found
        fileExtension = '.tsx';
      }
    }
  }

  return routePath.endsWith(fileExtension)
    ? routePath
    : `${routePath}${fileExtension}`;
}

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

  return joinPathFragments(project.root, remixConfig.appDirectory ?? 'app');
}
