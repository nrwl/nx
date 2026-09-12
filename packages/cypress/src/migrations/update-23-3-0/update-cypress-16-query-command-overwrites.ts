import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  visitNotIgnoredFiles,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { ast, query } from '@phenomnomnominal/tsquery';
import type {
  CallExpression,
  ElementAccessExpression,
  Node,
  PropertyAccessExpression,
  StringLiteralLike,
} from 'typescript';
import { hasLocalValueBinding } from '../../utils/migrations';

// Commands that became queries in Cypress 16
// (packages/driver/src/cy/commands/{cookies,storage}.ts).
const QUERY_COMMANDS = [
  'getCookie',
  'getCookies',
  'getAllCookies',
  'getAllLocalStorage',
  'getAllSessionStorage',
];

let ts: typeof import('typescript');

export default async function updateCypress16QueryCommandOverwrites(
  tree: Tree
) {
  const migrated: string[] = [];
  const shadowed: string[] = [];

  // Shared support libraries can hold the overwrites, so the whole workspace
  // is scanned rather than the Cypress project roots.
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!isJsTsFile(filePath)) {
      return;
    }

    const originalContent = tree.read(filePath, 'utf-8');
    if (!originalContent.includes('overwrite')) {
      return;
    }

    const sourceFile = ast(originalContent);
    const overwrites = findQueryOverwrites(sourceFile);
    if (overwrites.length === 0) {
      return;
    }
    // A file with its own `Cypress` value is not calling the global.
    if (hasLocalValueBinding(sourceFile, 'Cypress')) {
      shadowed.push(filePath);
      return;
    }

    tree.write(
      filePath,
      applyChangesToString(
        originalContent,
        overwrites.flatMap((call) => renameToOverwriteQuery(call))
      )
    );
    migrated.push(
      `${filePath}: ${overwrites
        .map((call) => `\`${call.arguments[0].getText()}\``)
        .join(', ')}`
    );
  });

  if (migrated.length === 0 && shadowed.length === 0) {
    return { skipAgentic: true };
  }

  if (migrated.length > 0) {
    await formatFiles(tree);
  }

  const shadowedNotes = shadowed.map(
    (filePath) =>
      `Left ${filePath} untouched because it declares its own \`Cypress\`; rename its \`Cypress.Commands.overwrite()\` calls for the cookie and storage queries to \`overwriteQuery()\` by hand if they target the Cypress global`
  );

  return {
    nextSteps: [
      ...migrated.map(
        (item) =>
          `Review the \`Cypress.Commands.overwriteQuery()\` callback in ${item}: it must return a function that computes the query result, not a chainable`
      ),
      ...shadowedNotes,
    ],
    agentContext: [
      ...migrated.map(
        (item) =>
          `Renamed \`Cypress.Commands.overwrite()\` to \`overwriteQuery()\` in ${item}`
      ),
      ...shadowedNotes,
    ],
  };
}

// `Cypress.Commands.overwrite(...)` for a command that became a query, with
// each member in dot or static bracket form.
function findQueryOverwrites(sourceFile: Node): CallExpression[] {
  ts ??= ensureTypescript();

  return query<CallExpression>(sourceFile, 'CallExpression').filter((call) => {
    const [commandName] = call.arguments;
    return (
      isCypressCommandsMember(call.expression, 'overwrite') &&
      commandName !== undefined &&
      isStringLiteral(commandName) &&
      QUERY_COMMANDS.includes(commandName.text)
    );
  });
}

type MemberAccess = PropertyAccessExpression | ElementAccessExpression;

function isCypressCommandsMember(
  node: Node,
  member: string
): node is MemberAccess {
  if (!isMemberAccess(node) || getStaticMemberName(node) !== member) {
    return false;
  }
  const commands = node.expression;
  return (
    isMemberAccess(commands) &&
    getStaticMemberName(commands) === 'Commands' &&
    ts.isIdentifier(commands.expression) &&
    commands.expression.text === 'Cypress'
  );
}

function isMemberAccess(node: Node): node is MemberAccess {
  return (
    ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
  );
}

function getStaticMemberName(node: MemberAccess): string | null {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }
  return isStringLiteral(node.argumentExpression)
    ? node.argumentExpression.text
    : null;
}

function isStringLiteral(node: Node): node is StringLiteralLike {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function renameToOverwriteQuery(call: CallExpression): StringChange[] {
  const callee = call.expression as MemberAccess;
  const member = ts.isPropertyAccessExpression(callee)
    ? callee.name
    : callee.argumentExpression;
  const quote = ts.isPropertyAccessExpression(callee)
    ? ''
    : member.getText()[0];
  const start = member.getStart();
  return [
    { type: ChangeType.Delete, start, length: member.getEnd() - start },
    {
      type: ChangeType.Insert,
      index: start,
      text: `${quote}overwriteQuery${quote}`,
    },
  ];
}

function isJsTsFile(filePath: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}
