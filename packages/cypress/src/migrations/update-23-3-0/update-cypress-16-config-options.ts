import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import type {
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertyName,
  ShorthandPropertyAssignment,
  StringLiteralLike,
} from 'typescript';
import {
  resolveCypressConfigObject,
  resolveObjectLiteral,
} from '../../utils/config';
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

// The property forms with a static name; spreads and methods are left alone.
type ConfigProperty = PropertyAssignment | ShorthandPropertyAssignment;

let ts: typeof import('typescript');

export default async function updateCypress16ConfigOptions(tree: Tree) {
  const unhandled: string[] = [];
  let wereConfigsMigrated = false;

  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      continue;
    }

    const contents = tree.read(cypressConfigPath, 'utf-8');
    const mentionedOptions = TRIGGER_OPTIONS.filter((option) =>
      contents.includes(option)
    );
    if (mentionedOptions.length === 0) {
      continue;
    }

    const config = resolveCypressConfigObject(contents);
    if (!config) {
      unhandled.push(
        `${cypressConfigPath}: the config object could not be resolved statically; it mentions ${mentionedOptions
          .map((option) => `\`${option}\``)
          .join(', ')}, migrate those by hand`
      );
      continue;
    }

    ts ??= ensureTypescript();
    const changes: StringChange[] = [];
    for (const block of getOptionBlocks(config)) {
      for (const property of block.properties) {
        if (!isConfigProperty(property)) {
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
          if (hasProperty(block, newName)) {
            changes.push(...removeProperty(contents, property));
          } else if (ts.isPropertyAssignment(property)) {
            changes.push(...replaceNode(property.name, newName));
          } else {
            changes.push(...replaceNode(property, `${newName}: ${name}`));
          }
        } else if (name === FAST_VISIBILITY_OPTION) {
          const strategy = getVisibilityStrategy(property);
          if (hasProperty(block, VISIBILITY_STRATEGY_OPTION)) {
            changes.push(...removeProperty(contents, property));
          } else if (strategy) {
            changes.push(
              ...replaceNode(
                property,
                `${VISIBILITY_STRATEGY_OPTION}: '${strategy}'`
              )
            );
          } else {
            unhandled.push(
              `${cypressConfigPath}: \`${FAST_VISIBILITY_OPTION}\` is set to a non-literal value (${getValueText(property)}); replace it with \`${VISIBILITY_STRATEGY_OPTION}: 'modern'\` (was true) or \`${VISIBILITY_STRATEGY_OPTION}: 'legacy'\` (was false)`
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

// Removed options whose value carried intent the replacement needs. A
// shorthand value is unknown, so it gets the follow-up too.
function getRemovalFollowUp(property: ConfigProperty): string | null {
  const name = getPropertyName(property.name);
  if (name === 'execTimeout') {
    return `removed \`${property.getText()}\`; \`cy.exec()\` is gone, set \`taskTimeout\` if the replacement \`cy.task()\` needs more than the 60000ms default`;
  }
  if (
    name === 'experimentalSourceRewriting' &&
    (ts.isShorthandPropertyAssignment(property) ||
      property.initializer.kind === ts.SyntaxKind.TrueKeyword)
  ) {
    return `removed \`${property.getText()}\`; set \`removeSRIAttributes: true\` if it worked around Subresource Integrity errors`;
  }
  return null;
}

// An `e2e`/`component` block held in a variable of the same file is edited
// in place, so it is collected like an inline one. One variable shared by
// both blocks is collected once, or its edits would apply twice.
function getOptionBlocks(
  config: ObjectLiteralExpression
): Set<ObjectLiteralExpression> {
  const blocks = new Set([config]);
  const sourceFile = config.getSourceFile();
  for (const property of config.properties) {
    if (
      !isConfigProperty(property) ||
      !TESTING_TYPE_BLOCKS.includes(getPropertyName(property.name))
    ) {
      continue;
    }
    const block = resolveObjectLiteral(
      ts.isPropertyAssignment(property) ? property.initializer : property.name,
      sourceFile
    );
    if (block) {
      blocks.add(block);
    }
  }
  return blocks;
}

function hasProperty(block: ObjectLiteralExpression, name: string): boolean {
  return block.properties.some(
    (property) =>
      isConfigProperty(property) && getPropertyName(property.name) === name
  );
}

function isConfigProperty(node: Node): node is ConfigProperty {
  return (
    ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)
  );
}

// A computed identifier (`[key]: value`) resolves at runtime, so it is skipped.
function getPropertyName(name: PropertyName): string | null {
  if (ts.isIdentifier(name) || isStringLiteralName(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name) && isStringLiteralName(name.expression)) {
    return name.expression.text;
  }
  return null;
}

function isStringLiteralName(node: Node): node is StringLiteralLike {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function getValueText(property: ConfigProperty): string {
  return ts.isPropertyAssignment(property)
    ? property.initializer.getText()
    : property.name.text;
}

function getVisibilityStrategy(
  property: ConfigProperty
): 'modern' | 'legacy' | null {
  if (ts.isShorthandPropertyAssignment(property)) {
    return null;
  }
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
  property: ConfigProperty
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

function replaceNode(node: Node, text: string): StringChange[] {
  const start = node.getStart();
  return [
    { type: ChangeType.Delete, start, length: node.getEnd() - start },
    { type: ChangeType.Insert, index: start, text },
  ];
}
