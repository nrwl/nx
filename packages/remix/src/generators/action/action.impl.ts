import { formatFiles, Tree } from '@nx/devkit';
import { insertImport } from '../../utils/insert-import';
import { insertStatementAfterImports } from '../../utils/insert-statement-after-imports';
import { insertStatementInDefaultFunction } from '../../utils/insert-statement-in-default-function';
import { LoaderSchema } from './schema';

export default async function (tree: Tree, schema: LoaderSchema) {
  const routeFilePath = schema.path;

  if (!tree.exists(routeFilePath)) {
    throw new Error(
      `Route path does not exist: ${routeFilePath}. Please generate a Remix route first.`
    );
  }

  insertImport(tree, routeFilePath, 'ActionFunctionArgs', '@remix-run/node', {
    typeOnly: true,
  });
  insertImport(tree, routeFilePath, 'json', '@remix-run/node');
  insertImport(tree, routeFilePath, 'useActionData', '@remix-run/react');

  insertStatementAfterImports(
    tree,
    routeFilePath,
    `
    export const action = async ({ request }: ActionFunctionArgs) => {
      let formData = await request.formData();

      return json({message: formData.toString()}, { status: 200 });
    };

    `
  );

  const statement = `\nconst actionMessage = useActionData<typeof action>();`;

  try {
    insertStatementInDefaultFunction(tree, routeFilePath, statement);
  } catch (err) {
    // eslint-disable-next-line no-empty
  } finally {
    await formatFiles(tree);
  }
}
