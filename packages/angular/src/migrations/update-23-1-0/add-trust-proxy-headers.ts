import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { FileChangeRecorder } from '../../utils/file-change-recorder';
import { getProjectsFilteredByDependencies } from '../utils/projects';

const TODO_COMMENT =
  '// TODO: This is a security-sensitive option. Remove if not needed. ' +
  'For more information, see https://angular.dev/best-practices/security#configuring-trusted-proxy-headers';
const TRUST_PROXY_HEADERS = `trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],`;

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/ssr',
  ]);

  for (const graphNode of projects) {
    visitNotIgnoredFiles(tree, graphNode.data.root, (path) => {
      if (!path.endsWith('.ts') || path.endsWith('.d.ts')) {
        return;
      }

      const content = tree.read(path, 'utf-8');
      if (!content) {
        return;
      }
      // Skip already-migrated files and files not instantiating an SSR engine.
      if (
        content.includes(TODO_COMMENT) ||
        (!content.includes('AngularNodeAppEngine') &&
          !content.includes('AngularAppEngine'))
      ) {
        return;
      }

      const sourceFile = ts.createSourceFile(
        path,
        content,
        ts.ScriptTarget.Latest,
        true
      );
      let recorder: FileChangeRecorder | undefined;

      const visit = (node: ts.Node): void => {
        if (
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          (node.expression.text === 'AngularNodeAppEngine' ||
            node.expression.text === 'AngularAppEngine')
        ) {
          if (!node.arguments || node.arguments.length === 0) {
            // No options object: insert one before the closing parenthesis.
            recorder ??= new FileChangeRecorder(tree, path);
            recorder.insertRight(
              node.end - 1,
              `{\n  ${TODO_COMMENT}\n  ${TRUST_PROXY_HEADERS}\n}`
            );
          } else if (ts.isObjectLiteralExpression(node.arguments[0])) {
            const optionsArg = node.arguments[0];
            const hasTrustProxyHeaders = optionsArg.properties.some(
              (prop) =>
                ts.isPropertyAssignment(prop) &&
                (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
                prop.name.text === 'trustProxyHeaders'
            );
            if (!hasTrustProxyHeaders) {
              // Insert right after the opening brace of the options object.
              recorder ??= new FileChangeRecorder(tree, path);
              recorder.insertRight(
                optionsArg.getStart() + 1,
                `\n  ${TODO_COMMENT}\n  ${TRUST_PROXY_HEADERS}`
              );
            }
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      if (recorder) {
        recorder.applyChanges();
      }
    });
  }

  await formatFiles(tree);
}
