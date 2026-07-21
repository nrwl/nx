import { glob, joinPathFragments, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import type {
  BinaryExpression,
  ExportAssignment,
  Expression,
  ExpressionStatement,
  InterfaceDeclaration,
  MethodSignature,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertySignature,
  SourceFile,
} from 'typescript';
import type {
  NxComponentTestingOptions,
  NxCypressE2EPresetOptions,
} from '../../plugins/cypress-preset';

export const CYPRESS_CONFIG_FILE_NAME_PATTERN =
  'cypress.config.{js,ts,mjs,cjs}';

const TS_QUERY_COMMON_JS_EXPORT_SELECTOR =
  'BinaryExpression:has(Identifier[name="module"]):has(Identifier[name="exports"])';
const TS_QUERY_EXPORT_CONFIG_PREFIX = `:matches(ExportAssignment, ${TS_QUERY_COMMON_JS_EXPORT_SELECTOR}) `;

// Shared so the CT generator (addDefaultCTConfig) and the
// disable-webpack-ct-just-in-time-compile migration emit the identical note.
export const JIT_COMPILE_DISABLE_COMMENT = [
  '// Cypress 14+ defaults justInTimeCompile to true (webpack only), which can',
  '// intermittently run 0 tests in CI. Remove this line to opt back in.',
];

export async function addDefaultE2EConfig(
  cyConfigContents: string,
  options: NxCypressE2EPresetOptions,
  baseUrl: string
) {
  if (!cyConfigContents) {
    throw new Error('The passed in cypress config file is empty!');
  }
  const { tsquery } = await import('@phenomnomnominal/tsquery');

  const isCommonJS =
    tsquery.query(cyConfigContents, TS_QUERY_COMMON_JS_EXPORT_SELECTOR).length >
    0;
  const testingTypeConfig = tsquery.query<PropertyAssignment>(
    cyConfigContents,
    `${TS_QUERY_EXPORT_CONFIG_PREFIX} PropertyAssignment:has(Identifier[name="e2e"])`
  );

  let updatedConfigContents = cyConfigContents;

  if (testingTypeConfig.length === 0) {
    // ESM-shape configs use `import.meta.url` (a `file://...` URL string)
    // because it's the most universally available `import.meta` field:
    // Node's native TS strip exposes it in ESM scope, and Cypress's bundled
    // tsx CJS loader provides it too (unlike `import.meta.dirname`, which
    // older tsx versions don't shim). CJS-shape configs use `__filename`
    // since `import.meta` isn't defined in plain CJS scope. The base
    // template is selected to match the workspace's `type` field, so the
    // shape detected here is consistent with how the file will actually be
    // evaluated at runtime. `nxBaseCypressPreset` normalizes either form.
    const pathToConfig = isCommonJS ? '__filename' : 'import.meta.url';
    const configValue = `nxE2EPreset(${pathToConfig}, ${JSON.stringify(
      options,
      null,
      2
    )
      .split('\n')
      .join('\n    ')})`;

    updatedConfigContents = tsquery.replace(
      cyConfigContents,
      `${TS_QUERY_EXPORT_CONFIG_PREFIX} ObjectLiteralExpression:first-child`,
      (node: ObjectLiteralExpression) => {
        let baseUrlContents = baseUrl ? `,\n    baseUrl: '${baseUrl}'` : '';
        if (node.properties.length > 0) {
          return `{
  ${node.properties.map((p) => p.getText()).join(',\n')},
  e2e: {
    ...${configValue}${baseUrlContents}
  }
}`;
        }
        return `{
  e2e: {
    ...${configValue}${baseUrlContents}
  }
}`;
      }
    );

    // @nx/cypress's package exports cover both bare and `.js`-suffixed
    // subpath forms, so emit the bare path - matches addDefaultCTConfig and
    // keeps generated configs free of incidental `.js` noise.
    return isCommonJS
      ? `const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');
${updatedConfigContents}`
      : `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
${updatedConfigContents}`;
  }
  return updatedConfigContents;
}

/**
 * Adds the nxComponentTestingPreset to the cypress config file.
 *
 * Pass `presetImportPath` (e.g. `@nx/angular/plugins/component-testing`) to
 * have the matching `import` (ESM) or `const { ... } = require(...)` (CJS)
 * statement prepended automatically based on the detected module shape.
 * Without it, the caller is responsible for prepending the import - but
 * doing so unconditionally produces mixed-syntax files in CJS workspaces
 * (an ESM `import` followed by a CJS `module.exports`), so prefer passing
 * `presetImportPath`.
 *
 * Pass `cypressMajorVersion` to opt webpack setups out of `justInTimeCompile`
 * on Cypress 14+, where it defaults to `true` and can intermittently run 0
 * tests in CI. The opt-out is emitted as an explicit `justInTimeCompile: false`
 * so it is visible and reversible.
 **/
export async function addDefaultCTConfig(
  cyConfigContents: string,
  options: NxComponentTestingOptions = {},
  presetImportPath?: string,
  cypressMajorVersion?: number | null
) {
  if (!cyConfigContents) {
    throw new Error('The passed in cypress config file is empty!');
  }
  const { tsquery } = await import('@phenomnomnominal/tsquery');

  const isCommonJS =
    tsquery.query(cyConfigContents, TS_QUERY_COMMON_JS_EXPORT_SELECTOR).length >
    0;
  const testingTypeConfig = tsquery.query<PropertyAssignment>(
    cyConfigContents,
    `${TS_QUERY_EXPORT_CONFIG_PREFIX} PropertyAssignment:has(Identifier[name="component"])`
  );

  let updatedConfigContents = cyConfigContents;

  if (testingTypeConfig.length === 0) {
    // See addDefaultE2EConfig for the rationale on __filename vs
    // import.meta.url.
    const pathToConfig = isCommonJS ? '__filename' : 'import.meta.url';
    // justInTimeCompile only applies to the webpack dev server and only exists
    // on Cypress 14+, where it defaults to true.
    const disableJustInTimeCompile =
      options.bundler !== 'vite' &&
      cypressMajorVersion != null &&
      cypressMajorVersion >= 14;
    let configValue = `nxComponentTestingPreset(${pathToConfig})`;
    if (options) {
      if (options.bundler !== 'vite') {
        // vite is the default bundler, so we don't need to set it
        delete options.bundler;
      }

      if (Object.keys(options).length) {
        configValue = `nxComponentTestingPreset(${pathToConfig}, ${JSON.stringify(
          options
        )})`;
      }
    }

    const jitComment = JIT_COMPILE_DISABLE_COMMENT.map(
      (line) => `    ${line}`
    ).join('\n');
    const componentValue = disableJustInTimeCompile
      ? `{
    ...${configValue},
${jitComment}
    justInTimeCompile: false,
  }`
      : configValue;

    updatedConfigContents = tsquery.replace(
      cyConfigContents,
      `${TS_QUERY_EXPORT_CONFIG_PREFIX} ObjectLiteralExpression:first-child`,
      (node: ObjectLiteralExpression) => {
        if (node.properties.length > 0) {
          return `{
  ${node.properties.map((p) => p.getText()).join(',\n')},
  component: ${componentValue}
}`;
        }
        return `{
  component: ${componentValue}
}`;
      }
    );
  }

  // Re-running the generator must not prepend a second declaration - Cypress
  // loads TS configs through esbuild, which rejects duplicate bindings.
  const isPresetAlreadyDeclared =
    tsquery.query(
      updatedConfigContents,
      ':matches(ImportSpecifier, BindingElement) Identifier[name="nxComponentTestingPreset"]'
    ).length > 0;

  if (presetImportPath && !isPresetAlreadyDeclared) {
    // Use the path verbatim - callers pass the public exported subpath. Don't
    // append `.js`: @nx/react and @nx/angular's package exports only declare
    // the bare `./plugins/component-testing` subpath, so a `.js` suffix
    // breaks strict ESM resolution with ERR_PACKAGE_PATH_NOT_EXPORTED.
    // (addDefaultE2EConfig hard-codes `.js` because @nx/cypress has no
    // exports map - it can get away with the suffix; subpath-exporting
    // packages cannot.)
    const prefix = isCommonJS
      ? `const { nxComponentTestingPreset } = require('${presetImportPath}');\n`
      : `import { nxComponentTestingPreset } from '${presetImportPath}';\n`;
    return `${prefix}${updatedConfigContents}`;
  }

  return updatedConfigContents;
}

/**
 * Adds the mount command for Cypress
 * Make sure after calling this the correct import statement is added
 * to bring in the correct mount from cypress.
 **/
export async function addMountDefinition(cmpCommandFileContents: string) {
  if (!cmpCommandFileContents) {
    throw new Error('The passed in cypress component file is empty!');
  }
  const { tsquery } = await import('@phenomnomnominal/tsquery');
  const hasMountCommand =
    tsquery.query<MethodSignature | PropertySignature>(
      cmpCommandFileContents,
      'CallExpression StringLiteral[value="mount"]'
    )?.length > 0;

  if (hasMountCommand) {
    return cmpCommandFileContents;
  }

  const mountCommand = `Cypress.Commands.add('mount', mount);`;

  const updatedInterface = tsquery.replace(
    cmpCommandFileContents,
    'InterfaceDeclaration',
    (node: InterfaceDeclaration) => {
      return `interface ${node.name.getText()}${
        node.typeParameters
          ? `<${node.typeParameters.map((p) => p.getText()).join(', ')}>`
          : ''
      } {
      ${node.members.map((m) => m.getText()).join('\n      ')}
      mount: typeof mount;
    }`;
    }
  );
  return `${updatedInterface}\n${mountCommand}`;
}

export function getProjectCypressConfigPath(
  tree: Tree,
  projectRoot: string
): string {
  const cypressConfigPaths = glob(tree, [
    joinPathFragments(projectRoot, CYPRESS_CONFIG_FILE_NAME_PATTERN),
  ]);
  if (cypressConfigPaths.length === 0) {
    throw new Error(`Could not find a cypress config file in ${projectRoot}.`);
  }

  return cypressConfigPaths[0];
}

export function resolveCypressConfigObject(
  cypressConfigContents: string
): ObjectLiteralExpression | null {
  const ts = ensureTypescript();

  const { tsquery } = <typeof import('@phenomnomnominal/tsquery')>(
    require('@phenomnomnominal/tsquery')
  );
  const sourceFile = tsquery.ast(cypressConfigContents);

  const exportDefaultStatement = sourceFile.statements.find(
    (statement): statement is ExportAssignment =>
      ts.isExportAssignment(statement)
  );

  if (exportDefaultStatement) {
    return resolveCypressConfigObjectFromExportExpression(
      exportDefaultStatement.expression,
      sourceFile
    );
  }

  const moduleExportsStatement = sourceFile.statements.find(
    (
      statement
    ): statement is ExpressionStatement & { expression: BinaryExpression } =>
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.left.getText() === 'module.exports'
  );

  if (moduleExportsStatement) {
    return resolveCypressConfigObjectFromExportExpression(
      moduleExportsStatement.expression.right,
      sourceFile
    );
  }

  return null;
}

function resolveCypressConfigObjectFromExportExpression(
  exportExpression: Expression,
  sourceFile: SourceFile
): ObjectLiteralExpression | null {
  const ts = ensureTypescript();

  if (ts.isObjectLiteralExpression(exportExpression)) {
    return exportExpression;
  }

  if (ts.isIdentifier(exportExpression)) {
    // try to locate the identifier in the source file
    const variableStatements = sourceFile.statements.filter((statement) =>
      ts.isVariableStatement(statement)
    );

    for (const variableStatement of variableStatements) {
      for (const declaration of variableStatement.declarationList
        .declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.getText() === exportExpression.getText() &&
          ts.isObjectLiteralExpression(declaration.initializer)
        ) {
          return declaration.initializer;
        }
      }
    }

    return null;
  }

  if (
    ts.isCallExpression(exportExpression) &&
    ts.isIdentifier(exportExpression.expression) &&
    exportExpression.expression.getText() === 'defineConfig' &&
    ts.isObjectLiteralExpression(exportExpression.arguments[0])
  ) {
    return exportExpression.arguments[0];
  }

  return null;
}
