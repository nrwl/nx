import {
  applyChangesToString,
  ChangeType,
  getProjects,
  StringChange,
  stripIndents,
  Tree,
  formatFiles,
} from '@nrwl/devkit';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import * as ts from 'typescript';

export async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((config, name) => {
    const isReactProject =
      config.targets.build?.executor === '@nrwl/web:webpack' &&
      /main\.(t|j)sx?$/.test(config.targets.build.options.main);

    if (isReactProject) {
      const sourcePath = config.targets.build.options.main;
      const sourceCode = tree.read(sourcePath).toString();
      const source = ts.createSourceFile(
        sourcePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );
      const result = applyChangesToString(
        sourceCode,
        migrateReactDomRender(sourcePath, source)
      );
      tree.write(sourcePath, result);
    }
  });

  await formatFiles(tree);
}

export function migrateReactDomRender(
  sourcePath: string,
  source: ts.SourceFile
): StringChange[] {
  const allImports = findNodes(
    source,
    ts.SyntaxKind.ImportDeclaration
  ) as ts.ImportDeclaration[];
  const reactDomImport = allImports.find(
    (x) => x.moduleSpecifier.getText() === "'react-dom'"
  );
  const changes = [] as StringChange[];

  if (reactDomImport) {
    changes.push({
      type: ChangeType.Insert,
      index: reactDomImport.moduleSpecifier.end - 1,
      text: '/client',
    });
  }

  const calls = findNodes(
    source,
    ts.SyntaxKind.CallExpression
  ) as ts.CallExpression[];
  const renderCall = calls.find((x) => {
    if (x.expression.kind !== ts.SyntaxKind.PropertyAccessExpression)
      return false;
    const expr = x.expression as ts.PropertyAccessExpression;
    return (
      expr.expression.getText() === 'ReactDOM' &&
      expr.name.getText() === 'render'
    );
  });

  if (renderCall) {
    const [element, querySelector] = renderCall.arguments;
    changes.push(
      {
        type: ChangeType.Delete,
        start: renderCall.getStart(),
        length: renderCall.end,
      },
      {
        type: ChangeType.Insert,
        index: renderCall.getStart(),
        text: stripIndents`
          const root = ReactDOM.createRoot(
            ${querySelector.getText()}${
          sourcePath.endsWith('.tsx') ? ' as HTMLElement' : ''
        }
          );
          root.render(
            ${element.getText()}
          );
        `,
      }
    );
  }

  return changes;
}

export default update;
