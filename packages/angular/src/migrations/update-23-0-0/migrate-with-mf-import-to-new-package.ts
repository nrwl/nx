import {
  type Tree,
  addDependenciesToPackageJson,
  formatFiles,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import { getProjectsFilteredByDependencies } from '../utils/projects';
import { nxVersion } from '../../utils/versions';

const NX_ANGULAR_MODULE_FEDERATION_IMPORT_SELECTOR =
  'ImportDeclaration > StringLiteral[value=@nx/angular/module-federation], VariableStatement CallExpression:has(Identifier[name=require]) > StringLiteral[value=@nx/angular/module-federation]';
const NEW_IMPORT_PATH = `'@nx/module-federation/angular'`;

export default async function migrateWithMfImport(tree: Tree) {
  const angularProjects = await getProjectsFilteredByDependencies([
    'npm:@nx/angular',
  ]);
  if (!angularProjects.length) {
    return;
  }

  let anyUpdated = false;
  for (const { data } of angularProjects) {
    visitNotIgnoredFiles(tree, data.root, (filePath) => {
      if (!filePath.endsWith('.ts') && !filePath.endsWith('.js')) {
        return;
      }
      let contents = tree.read(filePath, 'utf-8');
      if (!contents.includes('@nx/angular/module-federation')) {
        return;
      }

      const sourceFile = ast(contents);
      const importNodes = query(
        sourceFile,
        NX_ANGULAR_MODULE_FEDERATION_IMPORT_SELECTOR
      );
      if (importNodes.length === 0) {
        return;
      }

      // Iterate end-to-start so earlier replacements don't shift later offsets.
      for (let i = importNodes.length - 1; i >= 0; i--) {
        const node = importNodes[i];
        contents = `${contents.slice(
          0,
          node.getStart()
        )}${NEW_IMPORT_PATH}${contents.slice(node.getEnd())}`;
      }

      tree.write(filePath, contents);
      anyUpdated = true;
    });
  }

  if (anyUpdated) {
    addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/module-federation': nxVersion }
    );
  }

  await formatFiles(tree);
}
