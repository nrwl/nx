import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nrwl/devkit';
import type { NormalizedSchema, Schema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const { projectType, root, sourceRoot } = readProjectConfiguration(
    tree,
    options.project
  );
  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');

  const parsedName = options.name.split('/');
  const name = parsedName.pop();
  const namedPath = parsedName.join('/');

  const path =
    options.path ??
    joinPathFragments(
      projectSourceRoot,
      projectType === 'application' ? 'app' : 'lib',
      namedPath
    );

  return {
    ...options,
    name,
    type: options.type ?? 'component',
    changeDetection: options.changeDetection ?? 'Default',
    style: options.style ?? 'css',
    path,
    projectSourceRoot,
    projectRoot: root,
  };
}
