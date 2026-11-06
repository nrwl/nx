import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import type * as ts from 'typescript';
import { ensureTypescript, type TypescriptAst } from '@nx/devkit/internal';
import { FileChangeRecorder } from '../../utils/file-change-recorder';
import { getProjectsFilteredByDependencies } from '../utils/projects';

let tsModule: TypescriptAst;

const TODO_COMMENT =
  '// TODO: This is a security-sensitive option. Remove if not needed. ' +
  'For more information, see https://angular.dev/best-practices/security#configuring-trusted-proxy-headers';
const TRUST_PROXY_HEADERS = `trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],`;

export default async function (tree: Tree) {
  tsModule ??= ensureTypescript();
  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/ssr',
  ]);

  for (const graphNode of projects) {
    visitNotIgnoredFiles(tree, graphNode.data.root, (path) => {
      if (!path.endsWith('.ts') || path.endsWith('.d.ts')) {
        return;
      }

      const content = tree.read(path, 'utf-8');
      // Skip already-migrated files and files not instantiating an SSR engine.
      if (
        content.includes(TODO_COMMENT) ||
        (!content.includes('AngularNodeAppEngine') &&
          !content.includes('AngularAppEngine'))
      ) {
        return;
      }

      const sourceFile = tsModule.createSourceFile(
        path,
        content,
        tsModule.ScriptTarget.Latest,
        true
      );
      let recorder: FileChangeRecorder | undefined;

      const visit = (node: ts.Node): void => {
        if (
          tsModule.isNewExpression(node) &&
          tsModule.isIdentifier(node.expression) &&
          (node.expression.text === 'AngularNodeAppEngine' ||
            node.expression.text === 'AngularAppEngine')
        ) {
          if (!node.arguments) {
            // `new AngularAppEngine` without parentheses has no argument list.
            recorder ??= new FileChangeRecorder(tree, path);
            recorder.insertRight(
              node.end,
              `({\n  ${TODO_COMMENT}\n  ${TRUST_PROXY_HEADERS}\n})`
            );
          } else if (node.arguments.length === 0) {
            // No options object: insert one before the closing parenthesis.
            recorder ??= new FileChangeRecorder(tree, path);
            recorder.insertRight(
              node.end - 1,
              `{\n  ${TODO_COMMENT}\n  ${TRUST_PROXY_HEADERS}\n}`
            );
          } else if (tsModule.isObjectLiteralExpression(node.arguments[0])) {
            const optionsArg = node.arguments[0];
            // Any member kind counts (shorthand, method, accessor): adding the
            // property next to one would duplicate the key.
            const hasTrustProxyHeaders = optionsArg.properties.some(
              (prop) =>
                prop.name &&
                (tsModule.isIdentifier(prop.name) ||
                  tsModule.isStringLiteral(prop.name)) &&
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
        tsModule.forEachChild(node, visit);
      };

      visit(sourceFile);

      if (recorder) {
        recorder.applyChanges();
      }
    });
  }

  await formatFiles(tree);
}
