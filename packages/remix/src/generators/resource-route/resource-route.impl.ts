import { formatFiles, joinPathFragments, Tree } from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import {
  checkRoutePathForErrors,
  resolveRemixRouteFile,
} from '../../utils/remix-route-utils';
import actionGenerator from '../action/action.impl';
import loaderGenerator from '../loader/loader.impl';
import { RemixRouteSchema } from './schema';

export default async function (tree: Tree, options: RemixRouteSchema) {
  const {
    artifactName: name,
    directory,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    artifactType: 'resource-route',
    callingGenerator: '@nx/remix:resource-route',
    name: options.path.replace(/^\//, '').replace(/\/$/, ''),
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
  });

  if (!options.skipChecks && checkRoutePathForErrors(options.path)) {
    throw new Error(
      `Your route path has an indicator of an un-escaped dollar sign for a route param. If this was intended, include the --skipChecks flag.`
    );
  }

  const routeFilePath = await resolveRemixRouteFile(
    tree,
    options.nameAndDirectoryFormat === 'as-provided'
      ? joinPathFragments(directory, name)
      : options.path,
    options.nameAndDirectoryFormat === 'as-provided' ? undefined : projectName,
    '.ts'
  );

  if (tree.exists(routeFilePath))
    throw new Error(`Path already exists: ${options.path}`);

  if (!options.loader && !options.action)
    throw new Error(
      'The resource route generator requires either `loader` or `action` to be true'
    );

  tree.write(routeFilePath, '');

  if (options.loader) {
    await loaderGenerator(tree, {
      path: routeFilePath,
      nameAndDirectoryFormat: 'as-provided',
    });
  }

  if (options.action) {
    await actionGenerator(tree, {
      path: routeFilePath,
      nameAndDirectoryFormat: 'as-provided',
    });
  }

  await formatFiles(tree);
}
