import { tsquery } from '@phenomnomnominal/tsquery';
import { readJson, joinPathFragments, type Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { toProjectRelativePath } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { dirname } from 'path/posix';
import { coerce, major } from 'semver';

export function getConfigFilePath(tree: Tree, configDir: string) {
  return [
    joinPathFragments(configDir, `main.ts`),
    joinPathFragments(configDir, `main.cts`),
    joinPathFragments(configDir, `main.mts`),
    joinPathFragments(configDir, `main.js`),
    joinPathFragments(configDir, `main.cjs`),
    joinPathFragments(configDir, `main.mjs`),
  ].find((f) => tree.exists(f));
}

export function addConfigValuesToConfigFile(
  tree: Tree,
  configFile: string,
  configValues: Record<string, Record<string, unknown>>
) {
  const IMPORT_PROPERTY_SELECTOR = 'ImportDeclaration';
  const configFileContents = tree.read(configFile, 'utf-8');

  const ast = tsquery.ast(configFileContents);
  // AST TO GET SECTION TO APPEND TO
  const importNodes = tsquery(ast, IMPORT_PROPERTY_SELECTOR, {
    visitAllChildren: true,
  });
  let startPosition = 0;
  if (importNodes.length !== 0) {
    const lastImportNode = importNodes[importNodes.length - 1];
    startPosition = lastImportNode.getEnd();
  }

  const configValuesString = `
  // These options were migrated by @nx/storybook:convert-to-inferred from the project.json file.
  const configValues = ${JSON.stringify(configValues)};
  
  // Determine the correct configValue to use based on the configuration
  const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
  
  const options = {
    ...configValues.default,
    ...(configValues[nxConfiguration] ?? {})
  }`;

  tree.write(
    configFile,
    `${configFileContents.slice(0, startPosition)}
  ${configValuesString}
  ${configFileContents.slice(startPosition)}`
  );
}

export const STORYBOOK_PROP_MAPPINGS = {
  v7: {
    port: 'port',
    previewUrl: 'preview-url',
    host: 'host',
    docs: 'docs',
    configDir: 'config-dir',
    logLevel: 'loglevel',
    quiet: 'quiet',
    webpackStatsJson: 'webpack-stats-json',
    debugWebpack: 'debug-webpack',
    disableTelemetry: 'disable-telemetry',
    https: 'https',
    sslCa: 'ssl-ca',
    sslCert: 'ssl-cert',
    sslKey: 'ssl-key',
    smokeTest: 'smoke-test',
    noOpen: 'no-open',
    outputDir: 'output-dir',
  },
  v8: {
    port: 'port',
    previewUrl: 'preview-url',
    host: 'host',
    docs: 'docs',
    configDir: 'config-dir',
    logLevel: 'loglevel',
    quiet: 'quiet',
    webpackStatsJson: 'stats-json',
    debugWebpack: 'debug-webpack',
    disableTelemetry: 'disable-telemetry',
    https: 'https',
    sslCa: 'ssl-ca',
    sslCert: 'ssl-cert',
    sslKey: 'ssl-key',
    smokeTest: 'smoke-test',
    noOpen: 'no-open',
    outputDir: 'output-dir',
  },
};

export function ensureViteConfigPathIsRelative(
  tree: Tree,
  configPath: string,
  projectName: string,
  projectRoot: string,
  executorName: string,
  migrationLogs: AggregatedLog
) {
  const configFileContents = tree.read(configPath, 'utf-8');

  if (configFileContents.includes('viteFinal:')) {
    return;
  }

  const ast = tsquery.ast(configFileContents);
  const REACT_FRAMEWORK_SELECTOR_IDENTIFIERS =
    'PropertyAssignment:has(Identifier[name=framework]) PropertyAssignment:has(Identifier[name=name]) StringLiteral[value=@storybook/react-vite]';
  const REACT_FRAMEWORK_SELECTOR_STRING_LITERALS =
    'PropertyAssignment:has(StringLiteral[value=framework]) PropertyAssignment:has(StringLiteral[value=name]) StringLiteral[value=@storybook/react-vite]';

  const VUE_FRAMEWORK_SELECTOR_IDENTIFIERS =
    'PropertyAssignment:has(Identifier[name=framework]) PropertyAssignment:has(Identifier[name=name]) StringLiteral[value=@storybook/vue3-vite]';
  const VUE_FRAMEWORK_SELECTOR_STRING_LITERALS =
    'PropertyAssignment:has(StringLiteral[value=framework]) PropertyAssignment:has(StringLiteral[value=name]) StringLiteral[value=@storybook/vue3-vite]';
  const isUsingVite =
    tsquery(ast, REACT_FRAMEWORK_SELECTOR_IDENTIFIERS, {
      visitAllChildren: true,
    }).length > 0 ||
    tsquery(ast, REACT_FRAMEWORK_SELECTOR_STRING_LITERALS, {
      visitAllChildren: true,
    }).length > 0 ||
    tsquery(ast, VUE_FRAMEWORK_SELECTOR_STRING_LITERALS, {
      visitAllChildren: true,
    }).length > 0 ||
    tsquery(ast, VUE_FRAMEWORK_SELECTOR_IDENTIFIERS, { visitAllChildren: true })
      .length > 0;
  if (!isUsingVite) {
    return;
  }

  const VITE_CONFIG_PATH_SELECTOR =
    'PropertyAssignment:has(Identifier[name=framework]) PropertyAssignment PropertyAssignment PropertyAssignment:has(Identifier[name=viteConfigPath]) > StringLiteral';
  let viteConfigPathNodes = tsquery(ast, VITE_CONFIG_PATH_SELECTOR, {
    visitAllChildren: true,
  });
  if (viteConfigPathNodes.length === 0) {
    const VITE_CONFIG_PATH_SELECTOR_STRING_LITERALS =
      'PropertyAssignment:has(StringLiteral[value=framework]) PropertyAssignment PropertyAssignment PropertyAssignment:has(StringLiteral[value=viteConfigPath]) > StringLiteral:not(StringLiteral[value=viteConfigPath])';
    viteConfigPathNodes = tsquery(
      ast,
      VITE_CONFIG_PATH_SELECTOR_STRING_LITERALS,
      {
        visitAllChildren: true,
      }
    );

    if (viteConfigPathNodes.length === 0) {
      migrationLogs.addLog({
        project: projectName,
        executorName,
        log: 'Unable to find `viteConfigPath` in Storybook Config. Please ensure the `viteConfigPath` is relative to the project root.',
      });
      return;
    }
  }

  const viteConfigPathNode = viteConfigPathNodes[0];
  const pathToViteConfig = viteConfigPathNode.getText().replace(/('|")/g, '');
  if (pathToViteConfig.match(/^(\.\.\/|\.\/)/)) {
    return;
  }
  const relativePathToViteConfig = toProjectRelativePath(
    pathToViteConfig,
    projectRoot
  );

  tree.write(
    configPath,
    `${configFileContents.slice(
      0,
      viteConfigPathNode.getStart() + 1
    )}${relativePathToViteConfig}${configFileContents.slice(
      viteConfigPathNode.getEnd() - 1
    )}`
  );
}

export function getInstalledPackageVersion(
  tree: Tree,
  pkgName: string
): string | null {
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  const version = dependencies?.[pkgName] ?? devDependencies?.[pkgName];

  return version;
}

export function getInstalledPackageVersionInfo(tree: Tree, pkgName: string) {
  const version = getInstalledPackageVersion(tree, pkgName);

  return version ? { major: major(coerce(version)), version } : null;
}
