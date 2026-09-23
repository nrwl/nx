import {
  addDependenciesToPackageJson,
  formatFiles,
  getDependencyVersionFromPackageJson,
  globAsync,
  readJson,
  type Tree,
} from '@nx/devkit';
import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { ensureTypescript } from '@nx/js/internal';
import { dirname, resolve } from 'path';
import { lt, validRange } from 'semver';
import type {
  Expression,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  SourceFile,
  SpreadAssignment,
} from 'typescript';
import {
  CYPRESS_CONFIG_FILE_NAME_PATTERN,
  resolveCypressConfigObject,
  resolveObjectLiteral,
} from '../../utils/config';
import {
  cypressProjectConfigs,
  getComponentTestingPresetImport,
  getPropertyName,
} from '../../utils/migrations';
import { nxVersion } from '../../utils/versions';
import updateAngularZonelessMountImport from './update-angular-zoneless-mount-import';
import updateCypress16ConfigOptions from './update-cypress-16-config-options';
import updateCypress16QueryCommandOverwrites from './update-cypress-16-query-command-overwrites';

// Keep these versions pinned; versions.ts advances to later majors.
const CYPRESS_16_VERSIONS: Record<string, string> = {
  cypress: '^16.0.0',
  '@cypress/vite-dev-server': '^8.0.0',
  '@cypress/webpack-dev-server': '^6.0.0',
};
// Cypress 16 component testing throws on a Vite below 8 (getVite.js in its
// bundled vite-dev-server); the peer `vite ^8.0.0` also excludes 8 prereleases.
const VITE_FLOOR = '8.0.0';
const NX_VITE_CT_PRESET = '@nx/remix/plugins/component-testing';
const NX_WEBPACK_CT_PRESETS = [
  '@nx/angular/plugins/component-testing',
  '@nx/next/plugins/component-testing',
  '@nx/react/plugins/component-testing',
];
// Re-collects the Cypress 16 migrations: below the earliest one (23.3.0-beta.1),
// above every 23.2.x. `--from` is exclusive.
const REPLAN_COMMAND = `npx nx migrate @nx/cypress@${nxVersion} --from=@nx/cypress@23.3.0-beta.0`;
const RERUN_COMMAND = `${REPLAN_COMMAND} && npx nx migrate --run-migration=@nx/cypress:upgrade-to-cypress-16`;

type ComponentTestingBundler = 'vite' | 'other' | 'unknown';

type MigrationResult = {
  nextSteps: string[];
  agentContext: string[];
  skipAgentic?: boolean;
};

let ts: typeof import('typescript');

export default async function upgradeToCypress16(
  tree: Tree
): Promise<MigrationResult> {
  const declared = readJson(tree, 'package.json');
  const declaredCypress =
    declared.dependencies?.cypress ?? declared.devDependencies?.cypress;
  // Resolves a `catalog:` reference to its range; `addDependenciesToPackageJson`
  // then writes the bump into the catalog.
  const cypressRange = getDependencyVersionFromPackageJson(tree, 'cypress');
  if (
    !cypressRange ||
    !(validRange(cypressRange) || ['latest', 'next'].includes(cypressRange))
  ) {
    const reason = declaredCypress
      ? `\`cypress\` is declared as \`${declaredCypress}\` in package.json, which this migration cannot bump`
      : '`cypress` is not declared in the root package.json';
    return skipped(
      `${reason}. Move it to \`${CYPRESS_16_VERSIONS.cypress}\` by hand, install, and run \`${REPLAN_COMMAND} && npx nx migrate --run-migrations\` to apply the Cypress 16 migrations.`
    );
  }

  const blockers = await findViteBelowFloor(tree);
  if (blockers.length > 0) {
    return skipped(
      `Kept Cypress 15: Cypress 16 component testing requires Vite 8 and ${blockers.join(
        ', '
      )}. Update Vite to 8 (\`nx migrate\` bumps it through \`@nx/vite\`), then run \`${RERUN_COMMAND}\` to move to Cypress 16.`
    );
  }

  const bumped = Object.fromEntries(
    Object.entries(CYPRESS_16_VERSIONS).filter(
      ([name]) =>
        declared.devDependencies?.[name] || declared.dependencies?.[name]
    )
  );
  addDependenciesToPackageJson(tree, {}, bumped);

  const results: Array<
    { nextSteps?: string[]; agentContext?: string[] } | undefined
  > = [
    await updateCypress16ConfigOptions(tree),
    await updateCypress16QueryCommandOverwrites(tree),
    await updateAngularZonelessMountImport(tree),
  ];
  await formatFiles(tree);

  return {
    nextSteps: results.flatMap((result) => result?.nextSteps ?? []),
    agentContext: [
      `Bumped ${Object.entries(bumped)
        .map(([name, version]) => `\`${name}\` to \`${version}\``)
        .join(', ')} in package.json`,
      ...results.flatMap((result) => result?.agentContext ?? []),
    ],
  };
}

function skipped(message: string): MigrationResult {
  return { nextSteps: [message], agentContext: [], skipAgentic: true };
}

// The Cypress config files whose component testing would run on a Vite below
// 8. Vite is resolved from each config's directory, as Cypress does. A config
// whose bundler cannot be read statically counts when such a Vite resolves.
async function findViteBelowFloor(tree: Tree): Promise<string[]> {
  const cypressConfigPaths = new Set(
    await globAsync(tree, [`**/${CYPRESS_CONFIG_FILE_NAME_PATTERN}`])
  );
  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    cypressConfigPaths.add(cypressConfigPath);
  }

  const blockers: string[] = [];
  for (const cypressConfigPath of cypressConfigPaths) {
    const bundler = tree.exists(cypressConfigPath)
      ? getComponentTestingBundler(tree.read(cypressConfigPath, 'utf-8'))
      : 'unknown';
    if (bundler === 'other') {
      continue;
    }
    const viteVersion = getInstalledPackageVersion('vite', [
      resolve(tree.root, dirname(cypressConfigPath)),
    ]);
    if (!viteVersion || !lt(viteVersion, VITE_FLOOR)) {
      continue;
    }
    blockers.push(
      bundler === 'vite'
        ? `${cypressConfigPath} resolves Vite ${viteVersion}`
        : `${cypressConfigPath} resolves Vite ${viteVersion} and its bundler could not be determined statically`
    );
  }
  return blockers;
}

// Reads the `component` block of a config the way Cypress evaluates it:
// through same-file spreads and variables, last assignment wins. Anything that
// cannot be resolved statically (an imported spread, a preset options variable
// from another file, a computed bundler, a preset call not bound to an Nx
// preset module) is `unknown`.
function getComponentTestingBundler(contents: string): ComponentTestingBundler {
  ts ??= ensureTypescript();

  const config = resolveCypressConfigObject(contents);
  if (!config) {
    return 'unknown';
  }
  const component = findProperty(config, 'component');
  if (component === 'unresolved') {
    return 'unknown';
  }
  if (!component) {
    return 'other';
  }
  return classifyComponent(component, config.getSourceFile());
}

// The value assigned to `name` in `block`, following spreads of same-file
// objects, last member wins. `null` when the block has no such property,
// `'unresolved'` when the last member that could set it cannot be read: a
// spread of something unresolvable or a computed key.
function findProperty(
  block: ObjectLiteralExpression,
  name: string
): Expression | null | 'unresolved' {
  const sourceFile = block.getSourceFile();
  let value: Expression | null | 'unresolved' = null;

  for (const property of block.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = resolveObjectLiteral(property.expression, sourceFile);
      value = spread ? (findProperty(spread, name) ?? value) : 'unresolved';
      continue;
    }
    const memberName = getMemberName(property);
    if (memberName === 'unresolved') {
      value = 'unresolved';
    } else if (memberName === name) {
      value = ts.isPropertyAssignment(property)
        ? property.initializer
        : ts.isShorthandPropertyAssignment(property)
          ? property.name
          : 'unresolved';
    }
  }

  return value;
}

// The static name of an object member, `'unresolved'` for a computed key that
// is not a string literal.
function getMemberName(
  property: Exclude<ObjectLiteralElementLike, SpreadAssignment>
): string | null | 'unresolved' {
  const name = getPropertyName(property.name);
  return name === null && ts.isComputedPropertyName(property.name)
    ? 'unresolved'
    : name;
}

function classifyComponent(
  value: Expression,
  sourceFile: SourceFile
): ComponentTestingBundler {
  if (ts.isCallExpression(value)) {
    if (
      !ts.isIdentifier(value.expression) ||
      value.expression.text !== 'nxComponentTestingPreset'
    ) {
      return 'unknown';
    }
    const presetImport = getComponentTestingPresetImport(sourceFile);
    if (presetImport === NX_VITE_CT_PRESET) {
      return 'vite';
    }
    if (
      !NX_WEBPACK_CT_PRESETS.includes(presetImport) ||
      value.arguments.some((argument) => ts.isSpreadElement(argument))
    ) {
      return 'unknown';
    }
    // The other Nx presets bundle with webpack unless told otherwise.
    if (!value.arguments[1]) {
      return 'other';
    }
    const options = resolveObjectLiteral(value.arguments[1], sourceFile);
    return options ? getBundler(options, 'other') : 'unknown';
  }

  const component = resolveObjectLiteral(value, sourceFile);
  if (!component) {
    return 'unknown';
  }
  return classifyComponentObject(component, sourceFile) ?? 'other';
}

// The bundler set by the last member of a component object that can set one:
// a `devServer` property or a spread carrying one. `null` when none does.
function classifyComponentObject(
  component: ObjectLiteralExpression,
  sourceFile: SourceFile
): ComponentTestingBundler | null {
  let bundler: ComponentTestingBundler | null = null;
  for (const property of component.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (ts.isCallExpression(property.expression)) {
        bundler = classifyComponent(property.expression, sourceFile);
        continue;
      }
      const spread = resolveObjectLiteral(property.expression, sourceFile);
      bundler = spread
        ? (classifyComponentObject(spread, sourceFile) ?? bundler)
        : 'unknown';
      continue;
    }
    const memberName = getMemberName(property);
    if (memberName === 'unresolved') {
      bundler = 'unknown';
    } else if (memberName === 'devServer') {
      const devServer = ts.isPropertyAssignment(property)
        ? resolveObjectLiteral(property.initializer, sourceFile)
        : ts.isShorthandPropertyAssignment(property)
          ? resolveObjectLiteral(property.name, sourceFile)
          : null;
      // Cypress requires `bundler` in `devServer`, so a block without a
      // readable one holds it somewhere this migration cannot see.
      bundler = devServer ? getBundler(devServer, 'unknown') : 'unknown';
    }
  }
  return bundler;
}

// The `bundler` string in an options object, `missing` when it has none.
function getBundler(
  options: ObjectLiteralExpression,
  missing: ComponentTestingBundler
): ComponentTestingBundler {
  const bundler = findProperty(options, 'bundler');
  if (bundler === 'unresolved') {
    return 'unknown';
  }
  if (!bundler) {
    return missing;
  }
  if (
    ts.isStringLiteral(bundler) ||
    ts.isNoSubstitutionTemplateLiteral(bundler)
  ) {
    return bundler.text === 'vite' ? 'vite' : 'other';
  }
  return 'unknown';
}
