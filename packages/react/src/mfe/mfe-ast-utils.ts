import * as ts from 'typescript';
import { ChangeType, StringChange } from '@nrwl/devkit';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import {
  addImport,
  findClosestOpening,
  findElements,
} from '../utils/ast-utils';

export function addRemoteToMfeConfig(
  source: ts.SourceFile,
  app: string
): StringChange[] {
  const assignments = findNodes(
    source,
    ts.SyntaxKind.PropertyAssignment
  ) as ts.PropertyAssignment[];

  const remotesAssignment = assignments.find(
    (s) => s.name.getText() === 'remotes'
  );

  if (remotesAssignment) {
    const arrayExpression =
      remotesAssignment.initializer as ts.ArrayLiteralExpression;

    return arrayExpression.elements
      ? [
          {
            type: ChangeType.Insert,
            index:
              arrayExpression.elements[arrayExpression.elements.length - 1].end,
            text: `,`,
          },
          {
            type: ChangeType.Insert,
            index: remotesAssignment.end - 1,
            text: `'${app}',\n`,
          },
        ]
      : [];
  }

  const binaryExpressions = findNodes(
    source,
    ts.SyntaxKind.BinaryExpression
  ) as ts.BinaryExpression[];
  const exportExpression = binaryExpressions.find((b) => {
    if (b.left.kind === ts.SyntaxKind.PropertyAccessExpression) {
      const pae = b.left as ts.PropertyAccessExpression;
      return (
        pae.expression.getText() === 'module' &&
        pae.name.getText() === 'exports'
      );
    }
  });

  if (exportExpression?.right.kind === ts.SyntaxKind.ObjectLiteralExpression) {
    const ole = exportExpression.right as ts.ObjectLiteralExpression;
    return [
      {
        type: ChangeType.Insert,
        index: ole.end - 1,
        text: `remotes: ['${app}']\n`,
      },
    ];
  }

  return [];
}

export function addRemoteDefinition(
  source: ts.SourceFile,
  app: string
): StringChange[] {
  return [
    {
      type: ChangeType.Insert,
      index: source.end,
      text: `\ndeclare module '${app}/Module';`,
    },
  ];
}

export function addRemoteRoute(
  source: ts.SourceFile,
  names: {
    fileName: string;
    className: string;
  }
): StringChange[] {
  const routes = findElements(source, 'Route');
  const links = findElements(source, 'Link');

  if (routes.length === 0) {
    return [];
  } else {
    const changes: StringChange[] = [];
    const firstRoute = routes[0];
    const firstLink = links[0];

    changes.push(
      ...addImport(
        source,
        `const ${names.className} = React.lazy(() => import('${names.fileName}/Module'));`
      )
    );

    changes.push({
      type: ChangeType.Insert,
      index: firstRoute.end,
      text: `\n<Route path="/${names.fileName}" render={() => <${names.className} />} />`,
    });

    if (firstLink) {
      const parentLi = findClosestOpening('li', firstLink);
      if (parentLi) {
        changes.push({
          type: ChangeType.Insert,
          index: parentLi.end,
          text: `\n<li><Link to="/${names.fileName}">${names.className}</Link></li>`,
        });
      } else {
        changes.push({
          type: ChangeType.Insert,
          index: firstLink.parent.end,
          text: `\n<Link to="/${names.fileName}">${names.className}</Link>`,
        });
      }
    }

    return changes;
  }
}
