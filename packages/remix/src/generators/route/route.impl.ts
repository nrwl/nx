import { formatFiles, names, stripIndents, Tree } from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { basename, dirname } from 'path';
import { checkRoutePathForErrors } from '../../utils/remix-route-utils';
import ActionGenerator from '../action/action.impl';
import LoaderGenerator from '../loader/loader.impl';
import MetaGenerator from '../meta/meta.impl';
import StyleGenerator from '../style/style.impl';
import { RemixRouteSchema } from './schema';

export default async function (tree: Tree, options: RemixRouteSchema) {
  const { artifactName: name, filePath: routeFilePath } =
    await determineArtifactNameAndDirectoryOptions(tree, {
      path: options.path.replace(/^\//, '').replace(/\/$/, ''),
      allowedFileExtensions: ['ts', 'tsx'],
      fileExtension: 'tsx',
    });

  if (!options.skipChecks && checkRoutePathForErrors(options.path)) {
    throw new Error(
      `Your route path has an indicator of an un-escaped dollar sign for a route param. If this was intended, include the --skipChecks flag.`
    );
  }

  const { className: componentName } = names(
    name === '.' || name === '' ? basename(dirname(routeFilePath)) : name
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
    });
  }

  if (options.meta) {
    await MetaGenerator(tree, {
      path: routeFilePath,
    });
  }

  if (options.action) {
    await ActionGenerator(tree, {
      path: routeFilePath,
    });
  }

  if (options.style === 'css') {
    await StyleGenerator(tree, {
      path: routeFilePath,
    });
  }

  await formatFiles(tree);
}
