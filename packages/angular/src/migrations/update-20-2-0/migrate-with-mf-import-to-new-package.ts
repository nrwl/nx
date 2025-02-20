import {
  type Tree,
  formatFiles,
  readProjectConfiguration,
  visitNotIgnoredFiles,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { nxVersion } from '../../utils/versions';

const NX_ANGULAR_MODULE_FEDERATION_IMPORT_SELECTOR =
  'ImportDeclaration > StringLiteral[value=@nx/angular/module-federation], VariableStatement CallExpression:has(Identifier[name=require]) > StringLiteral[value=@nx/angular/module-federation]';
const NEW_IMPORT_PATH = `'@nx/module-federation/angular'`;

export default async function migrateWithMfImport(tree: Tree) {
  const projects = new Set<string>();

  forEachExecutorOptions(
    tree,
    '@nx/angular:webpack-browser',
    (options, project, target) => {
      const projectConfig = readProjectConfiguration(tree, project);
      projects.add(projectConfig.root);
    }
  );

  for (const projectRoot of projects) {
    visitNotIgnoredFiles(tree, projectRoot, (filePath) => {
      if (!filePath.endsWith('.ts') && !filePath.endsWith('.js')) {
        return;
      }
      let contents = tree.read(filePath, 'utf-8');
      if (!contents.includes('@nx/angular/module-federation')) {
        return;
      }

      const ast = tsquery.ast(contents);
      const importNodes = tsquery(
        ast,
        NX_ANGULAR_MODULE_FEDERATION_IMPORT_SELECTOR
      );

      if (importNodes.length === 0) {
        return;
      }
      const importPathNode = importNodes[0];

      contents = `${contents.slice(
        0,
        importPathNode.getStart()
      )}${NEW_IMPORT_PATH}${contents.slice(importPathNode.getEnd())}`;

      tree.write(filePath, contents);
    });
  }

  if (projects.size !== 0) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/module-federation': nxVersion,
      }
    );
  }

  await formatFiles(tree);
}
