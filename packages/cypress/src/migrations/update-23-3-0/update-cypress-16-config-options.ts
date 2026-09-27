import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import type {
  Expression,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertyName,
  ShorthandPropertyAssignment,
  SpreadAssignment,
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
const MIGRATE_BY_HAND = `migrate ${[
  ...REMOVED_OPTIONS,
  ...Object.keys(RENAMED_OPTIONS),
  FAST_VISIBILITY_OPTION,
]
  .map((option) => `\`${option}\``)
  .join(', ')} in its source by hand if it sets them`;
// Cypress reads these options at the top level and inside `e2e`/`component`.
const TESTING_TYPE_BLOCKS = ['e2e', 'component'];
// The Nx presets never return one of the options above, so their spreads
// are not reported as unresolved.
const NX_PRESET_CALLS = ['nxE2EPreset', 'nxComponentTestingPreset'];

// The property forms with a static name; methods are left alone.
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
    const config = resolveCypressConfigObject(contents);
    if (!config) {
      unhandled.push(
        `${cypressConfigPath}: the config object could not be resolved statically; ${MIGRATE_BY_HAND}`
      );
      continue;
    }

    ts ??= ensureTypescript();
    const { blocks, unresolvedSpreads } = getOptionBlocks(config);
    for (const spread of unresolvedSpreads) {
      unhandled.push(
        `${cypressConfigPath}: the \`${spread.getText()}\` spread could not be resolved statically; ${MIGRATE_BY_HAND}`
      );
    }
    const changes: StringChange[] = [];
    for (const block of blocks) {
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

// The option blocks the config is made of: the config object, its `e2e` and
// `component` blocks, and the same-file objects spread into any of them,
// each edited in place. `e2e`/`component` are only read at the top level,
// which the objects spread into the config are part of, so that level is
// collected first. A spread that resolves to nothing is returned so it can
// be reported, the Nx preset calls aside.
function getOptionBlocks(config: ObjectLiteralExpression): {
  blocks: Set<ObjectLiteralExpression>;
  unresolvedSpreads: SpreadAssignment[];
} {
  const sourceFile = config.getSourceFile();
  const unresolvedSpreads: SpreadAssignment[] = [];

  // Collects `root` and the objects reachable from it through spreads.
  // A collected object is not scanned again, so an object shared by
  // several blocks is edited and reported once.
  const collect = (
    root: ObjectLiteralExpression,
    into: Set<ObjectLiteralExpression>
  ) => {
    if (into.has(root)) {
      return;
    }
    into.add(root);
    for (const property of root.properties) {
      if (
        !ts.isSpreadAssignment(property) ||
        isNxPresetCall(property.expression)
      ) {
        continue;
      }
      const block = resolveObjectLiteral(property.expression, sourceFile);
      if (block) {
        collect(block, into);
      } else {
        unresolvedSpreads.push(property);
      }
    }
  };

  const topLevel = new Set<ObjectLiteralExpression>();
  collect(config, topLevel);
  const blocks = new Set(topLevel);
  for (const block of topLevel) {
    for (const property of block.properties) {
      if (
        !isConfigProperty(property) ||
        !TESTING_TYPE_BLOCKS.includes(getPropertyName(property.name))
      ) {
        continue;
      }
      const nested = resolveObjectLiteral(
        ts.isPropertyAssignment(property)
          ? property.initializer
          : property.name,
        sourceFile
      );
      if (nested) {
        collect(nested, blocks);
      }
    }
  }
  return { blocks, unresolvedSpreads };
}

function isNxPresetCall(expression: Expression): boolean {
  return (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    NX_PRESET_CALLS.includes(expression.expression.text)
  );
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
  // The node ends before its trailing trivia, so the comma can sit behind a
  // comment or a line break.
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    contents,
    undefined,
    end
  );
  if (scanner.scan() === ts.SyntaxKind.CommaToken) {
    end = scanner.getTokenEnd();
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
