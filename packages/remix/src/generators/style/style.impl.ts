import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nx/devkit';
import { RemixStyleSchema } from './schema';

import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { dirname, relative } from 'path';
import { insertImport } from '../../utils/insert-import';
import { insertStatementAfterImports } from '../../utils/insert-statement-after-imports';
import {
  normalizeRoutePath,
  resolveRemixAppDirectory,
} from '../../utils/remix-route-utils';

export default async function (tree: Tree, options: RemixStyleSchema) {
  const { project: projectName, artifactName: name } =
    await determineArtifactNameAndDirectoryOptions(tree, {
      path: options.path,
    });
  const project = readProjectConfiguration(tree, projectName);
  if (!project) throw new Error(`Project does not exist: ${projectName}`);

  const appDir = await resolveRemixAppDirectory(tree, project.name);
  const normalizedRoutePath = `${normalizeRoutePath(options.path)
    .replace(/^\//, '')
    .replace('.tsx', '')}.css`;
  const stylesheetPath = joinPathFragments(
    appDir,
    'styles',
    normalizedRoutePath
  );

  tree.write(
    stylesheetPath,
    stripIndents`
      :root {
        --color-foreground: #fff;
        --color-background: #143157;
        --color-links: hsl(214, 73%, 69%);
        --color-border: #275da8;
        --font-body: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          Liberation Mono, Courier New, monospace;
      }
    `
  );

  const routeFilePath = options.path;

  insertImport(tree, routeFilePath, 'LinksFunction', '@remix-run/node', {
    typeOnly: true,
  });

  if (project.root === '.') {
    insertStatementAfterImports(
      tree,
      routeFilePath,
      `
    import stylesUrl from '~/styles/${normalizedRoutePath}'

    export const links: LinksFunction = () => {
      return [{ rel: 'stylesheet', href: stylesUrl }];
    };
  `
    );
  } else {
    insertStatementAfterImports(
      tree,
      routeFilePath,
      `
    import stylesUrl from '${relative(dirname(routeFilePath), stylesheetPath)}';

    export const links: LinksFunction = () => {
      return [{ rel: 'stylesheet', href: stylesUrl }];
    };
  `
    );
  }

  await formatFiles(tree);
}
