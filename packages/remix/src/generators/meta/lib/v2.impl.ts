import { formatFiles, Tree } from '@nx/devkit';
import { getDefaultExportName } from '../../../utils/get-default-export-name';
import { insertImport } from '../../../utils/insert-import';
import { insertStatementAfterImports } from '../../../utils/insert-statement-after-imports';
import { resolveRemixRouteFile } from '../../../utils/remix-route-utils';
import { MetaSchema } from '../schema';

export async function v2MetaGenerator(tree: Tree, schema: MetaSchema) {
  const routeFilePath =
    schema.nameAndDirectoryFormat === 'as-provided'
      ? schema.path
      : await resolveRemixRouteFile(tree, schema.path, schema.project);

  if (!tree.exists(routeFilePath)) {
    throw new Error(
      `Route path does not exist: ${routeFilePath}. Please generate a Remix route first.`
    );
  }

  insertImport(tree, routeFilePath, 'MetaFunction', '@remix-run/node', {
    typeOnly: true,
  });

  const defaultExportName = getDefaultExportName(tree, routeFilePath);
  insertStatementAfterImports(
    tree,
    routeFilePath,
    `
    export const meta: MetaFunction = () => {
      return [{ title: '${defaultExportName} Route' }];
    };

    `
  );
  await formatFiles(tree);
}
