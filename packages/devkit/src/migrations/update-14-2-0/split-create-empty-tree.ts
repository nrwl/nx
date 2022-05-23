import { Tree } from 'nx/src/generators/tree';
import { getProjects } from 'nx/src/generators/utils/project-configuration';
import {
  StringChange,
  ChangeType,
  applyChangesToString,
} from '../../utils/string-change';
import { extname } from 'path';
import { tsquery } from '@phenomnomnominal/tsquery';

import { visitNotIgnoredFiles } from '../../generators/visit-not-ignored-files';
import { formatFiles } from '@nrwl/devkit';

export default async function update(tree: Tree): Promise<void> {
  for (const [project, { root }] of getProjects(tree)) {
    visitNotIgnoredFiles(tree, root, (filePath) => {
      if (extname(filePath) === '.ts') {
        let changed = false;
        let file = tree.read(filePath).toString();

        // Need to import createTreeWithEmptyV1Workspace, and use it instead
        if (
          file.includes('createTreeWithEmptyWorkspace(1)') ||
          file.includes('createTreeWithEmptyWorkspace()')
        ) {
          changed = true;
          file = file.replace(
            /createTreeWithEmptyWorkspace\(1\)/g,
            'createTreeWithEmptyV1Workspace()'
          );
          file = file.replace(
            /createTreeWithEmptyWorkspace\(\)/g,
            'createTreeWithEmptyV1Workspace()'
          );

          // Was only using v1, simple string replace updates imports.
          if (!file.includes('createTreeWithEmptyWorkspace(2)')) {
            file = file.replace(
              'createTreeWithEmptyWorkspace',
              'createTreeWithEmptyV1Workspace'
            );
          } else {
            const changes: StringChange[] = [];
            const ast = tsquery.ast(file);
            const importDeclarations = tsquery(
              ast,
              'ImportDeclaration[moduleSpecifier.text="@nrwl/devkit/testing"]'
            );
            for (const declaration of importDeclarations) {
              const namedImports = tsquery(
                declaration,
                'NamedImports ImportSpecifier'
              );
              if (namedImports.length) {
                const firstImport = namedImports[0].pos;
                changes.push({
                  type: ChangeType.Insert,
                  index: firstImport,
                  text: ' createTreeWithEmptyV1Workspace,',
                });
                break;
              }
            }
            file = applyChangesToString(file, changes);
          }
        }

        // Replace all instances with param set to 2, to version w/o param
        if (file.includes('createTreeWithEmptyWorkspace(2)')) {
          file = file.replace(
            /createTreeWithEmptyWorkspace\(2\)/g,
            'createTreeWithEmptyWorkspace()'
          );
          changed = true;
        }

        if (changed) {
          tree.write(filePath, file);
        }
      }
    });
  }
  await formatFiles(tree);
}
