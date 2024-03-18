import {
  formatFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { basename, dirname } from 'path';
import {
  checkRoutePathForErrors,
  resolveRemixRouteFile,
} from '../../utils/remix-route-utils';
import ActionGenerator from '../action/action.impl';
import LoaderGenerator from '../loader/loader.impl';
import MetaGenerator from '../meta/meta.impl';
import StyleGenerator from '../style/style.impl';
import { RemixRouteSchema } from './schema';

export default async function (tree: Tree, options: RemixRouteSchema) {
  const {
    artifactName: name,
    directory,
    project: projectName,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    artifactType: 'route',
    callingGenerator: '@nx/remix:route',
    name: options.path.replace(/^\//, '').replace(/\/$/, ''),
    nameAndDirectoryFormat: options.nameAndDirectoryFormat,
    project: options.project,
  });

  const project = readProjectConfiguration(tree, projectName);
  if (!project) throw new Error(`Project does not exist: ${projectName}`);

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
    '.tsx'
  );

  const nameToUseForComponent =
    options.nameAndDirectoryFormat === 'as-provided'
      ? name.replace('.tsx', '')
      : options.path.replace(/^\//, '').replace(/\/$/, '').replace('.tsx', '');

  const { className: componentName } = names(
    nameToUseForComponent === '.' || nameToUseForComponent === ''
      ? basename(dirname(routeFilePath))
      : nameToUseForComponent
  );

  if (tree.exists(routeFilePath))
    throw new Error(`Path already exists: ${routeFilePath}`);

  tree.write(
    routeFilePath,
    stripIndents`


    export default function ${componentName}() {
    ${
      options.loader
        ? `
      return (
        <p>
          Message: {data.message}
        </p>
      );
    `
        : `return (<p>${componentName} works!</p>)`
    }
    }
  `
  );

  if (options.loader) {
    await LoaderGenerator(tree, {
      path: routeFilePath,
      nameAndDirectoryFormat: 'as-provided',
    });
  }

  if (options.meta) {
    await MetaGenerator(tree, {
      path: routeFilePath,
      nameAndDirectoryFormat: 'as-provided',
    });
  }

  if (options.action) {
    await ActionGenerator(tree, {
      path: routeFilePath,
      nameAndDirectoryFormat: 'as-provided',
    });
  }

  if (options.style === 'css') {
    await StyleGenerator(tree, {
      project: projectName,
      path: routeFilePath,
      nameAndDirectoryFormat: 'as-provided',
    });
  }

  await formatFiles(tree);
}
