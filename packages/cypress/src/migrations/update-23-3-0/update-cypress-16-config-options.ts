import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import type {
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertyName,
} from 'typescript';
import { resolveCypressConfigObject } from '../../utils/config';
import { cypressProjectConfigs } from '../../utils/migrations';

// Cypress 16 breakingOptions (packages/config/src/options.ts).
const REMOVED_OPTIONS = [
  'experimentalSourceRewriting',
  'allowCypressEnv',
  'execTimeout',
];
const RENAMED_OPTIONS: Record<string, string> = {
  experimentalMemoryManagement: 'manageBrowserMemory',
};
const FAST_VISIBILITY_OPTION = 'experimentalFastVisibility';
const VISIBILITY_STRATEGY_OPTION = 'visibilityStrategy';
const TRIGGER_OPTIONS = [
  ...REMOVED_OPTIONS,
  ...Object.keys(RENAMED_OPTIONS),
  FAST_VISIBILITY_OPTION,
];
// Cypress reads these options at the top level and inside `e2e`/`component`.
const TESTING_TYPE_BLOCKS = ['e2e', 'component'];

let ts: typeof import('typescript');

export default async function updateCypress16ConfigOptions(tree: Tree) {
  const unhandled: string[] = [];
  let wereConfigsMigrated = false;

  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      continue;
    }

    const contents = tree.read(cypressConfigPath, 'utf-8');
    if (!TRIGGER_OPTIONS.some((option) => contents.includes(option))) {
      continue;
    }

    const config = resolveCypressConfigObject(contents);
    if (!config) {
      continue;
    }

    ts ??= ensureTypescript();
    const changes: StringChange[] = [];
    for (const block of getOptionBlocks(config)) {
      for (const property of block.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }
        const name = getPropertyName(property.name);
        if (name === null) {
          continue;
        }

        if (REMOVED_OPTIONS.includes(name)) {
          changes.push(...removeProperty(contents, property));
          const followUp = getRemovalFollowUp(property);
          if (followUp) {
            unhandled.push(`${cypressConfigPath}: ${followUp}`);
          }
        } else if (name in RENAMED_OPTIONS) {
          const newName = RENAMED_OPTIONS[name];
          changes.push(
            ...(hasProperty(block, newName)
              ? removeProperty(contents, property)
              : replaceNode(property.name, quoteLike(property.name, newName)))
          );
        } else if (name === FAST_VISIBILITY_OPTION) {
          const strategy = getVisibilityStrategy(property);
          if (hasProperty(block, VISIBILITY_STRATEGY_OPTION)) {
            changes.push(...removeProperty(contents, property));
          } else if (strategy) {
            changes.push(
              ...replaceNode(
                property,
                `${quoteLike(
                  property.name,
                  VISIBILITY_STRATEGY_OPTION
                )}: '${strategy}'`
              )
            );
          } else {
            unhandled.push(
              `${cypressConfigPath}: \`${FAST_VISIBILITY_OPTION}\` is set to a non-literal value (${property.initializer.getText()}); replace it with \`${VISIBILITY_STRATEGY_OPTION}: 'modern'\` (was true) or \`${VISIBILITY_STRATEGY_OPTION}: 'legacy'\` (was false)`
            );
          }
        }
      }
    }

    if (changes.length > 0) {
      tree.write(cypressConfigPath, applyChangesToString(contents, changes));
      wereConfigsMigrated = true;
    }
  }

  if (wereConfigsMigrated) {
    await formatFiles(tree);
  }

  if (unhandled.length > 0) {
    return {
      nextSteps: unhandled.map(
        (item) => `Review the Cypress config option change: ${item}`
      ),
      agentContext: unhandled,
    };
  }
}

// Removed options whose value carried intent the replacement needs.
function getRemovalFollowUp(property: PropertyAssignment): string | null {
  const name = getPropertyName(property.name);
  if (name === 'execTimeout') {
    return `removed \`execTimeout: ${property.initializer.getText()}\`; \`cy.exec()\` is gone, set \`taskTimeout\` if the replacement \`cy.task()\` needs more than the 60000ms default`;
  }
  if (
    name === 'experimentalSourceRewriting' &&
    property.initializer.kind === ts.SyntaxKind.TrueKeyword
  ) {
    return `removed \`experimentalSourceRewriting: true\`; set \`removeSRIAttributes: true\` if it worked around Subresource Integrity errors`;
  }
  return null;
}

function getOptionBlocks(
  config: ObjectLiteralExpression
): ObjectLiteralExpression[] {
  const blocks = [config];
  for (const property of config.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      TESTING_TYPE_BLOCKS.includes(getPropertyName(property.name)) &&
      ts.isObjectLiteralExpression(property.initializer)
    ) {
      blocks.push(property.initializer);
    }
  }
  return blocks;
}

function hasProperty(block: ObjectLiteralExpression, name: string): boolean {
  return block.properties.some(
    (property) =>
      ts.isPropertyAssignment(property) &&
      getPropertyName(property.name) === name
  );
}

function getPropertyName(name: PropertyName): string | null {
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
    ? name.text
    : null;
}

function quoteLike(name: PropertyName, text: string): string {
  const original = name.getText();
  return ts.isIdentifier(name) ? text : `${original[0]}${text}${original[0]}`;
}

function getVisibilityStrategy(
  property: PropertyAssignment
): 'modern' | 'legacy' | null {
  switch (property.initializer.kind) {
    case ts.SyntaxKind.TrueKeyword:
      return 'modern';
    case ts.SyntaxKind.FalseKeyword:
      return 'legacy';
    default:
      return null;
  }
}

// Removes the property with its trailing comma, and the whole line when the
// property is alone on it.
function removeProperty(
  contents: string,
  property: PropertyAssignment
): StringChange[] {
  let start = property.getStart();
  let end = property.getEnd();
  if (contents[end] === ',') {
    end++;
  }
  const lineStart = contents.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = contents.indexOf('\n', end);
  const restOfLine =
    lineEnd === -1 ? contents.slice(end) : contents.slice(end, lineEnd);
  if (
    contents.slice(lineStart, start).trim() === '' &&
    restOfLine.trim() === ''
  ) {
    start = lineStart;
    end = lineEnd === -1 ? contents.length : lineEnd + 1;
  }
  return [{ type: ChangeType.Delete, start, length: end - start }];
}

function replaceNode(
  node: import('typescript').Node,
  text: string
): StringChange[] {
  const start = node.getStart();
  return [
    { type: ChangeType.Delete, start, length: node.getEnd() - start },
    { type: ChangeType.Insert, index: start, text },
  ];
}
