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
import type { CallExpression } from 'typescript';
import { cypressProjectConfigs } from '../../utils/migrations';

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

  for await (const { projectConfig } of cypressProjectConfigs(tree)) {
    visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
      if (!isJsTsFile(filePath) || !tree.exists(filePath)) {
        return;
      }

      const originalContent = tree.read(filePath, 'utf-8');
      if (!originalContent.includes('overwrite')) {
        return;
      }

      const overwrites = findQueryOverwrites(originalContent);
      if (overwrites.length === 0) {
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
  }

  if (migrated.length === 0) {
    return { skipAgentic: true };
  }

  await formatFiles(tree);

  return {
    nextSteps: migrated.map(
      (item) =>
        `Review the \`Cypress.Commands.overwriteQuery()\` callback in ${item}: it must return a function that computes the query result, not a chainable`
    ),
    agentContext: migrated.map(
      (item) =>
        `Renamed \`Cypress.Commands.overwrite()\` to \`overwriteQuery()\` in ${item}`
    ),
  };
}

function findQueryOverwrites(content: string): CallExpression[] {
  ts ??= ensureTypescript();

  return query<CallExpression>(
    ast(content),
    'CallExpression:has(PropertyAccessExpression > Identifier[name="overwrite"])'
  ).filter((call) => {
    const callee = call.expression;
    const [commandName] = call.arguments;
    return (
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === 'overwrite' &&
      callee.expression.getText() === 'Cypress.Commands' &&
      commandName !== undefined &&
      (ts.isStringLiteral(commandName) ||
        ts.isNoSubstitutionTemplateLiteral(commandName)) &&
      QUERY_COMMANDS.includes(commandName.text)
    );
  });
}

function renameToOverwriteQuery(call: CallExpression): StringChange[] {
  const name = (
    call.expression as import('typescript').PropertyAccessExpression
  ).name;
  const start = name.getStart();
  return [
    { type: ChangeType.Delete, start, length: name.getEnd() - start },
    { type: ChangeType.Insert, index: start, text: 'overwriteQuery' },
  ];
}

function isJsTsFile(filePath: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}
