/**
 * Executors & Generators old url schemes to package schema viewer url schemes (added 2022-03-16)
 */
const schemaUrls = {
  '/workspace/library': '/packages/workspace/generators/library',
  '/workspace/npm-package': '/packages/workspace/generators/npm-package',
  '/workspace/move': '/packages/workspace/generators/move',
  '/workspace/remove': '/packages/workspace/generators/remove',
  '/workspace/run-commands-generator':
    '/packages/workspace/generators/run-commands',
  '/workspace/workspace-generator':
    '/packages/workspace/generators/workspace-generator',
  '/workspace/convert-to-nx-project-generator':
    '/packages/workspace/generators/convert-to-nx-project',
  '/workspace/run-commands-executor':
    '/packages/workspace/executors/run-commands',
  '/workspace/run-script': '/packages/workspace/executors/run-script',
  '/js/library': '/packages/js/generators/library',
  '/js/convert-to-swc': '/packages/js/generators/convert-to-swc',
  '/js/tsc': '/packages/js/executors/tsc',
  '/js/swc': '/packages/js/executors/swc',
  '/web/application': '/packages/web/generators/application',
  '/web/build': '/packages/web/executors/webpack',
  '/web/dev-server': '/packages/web/executors/dev-server',
  '/web/file-server': '/packages/web/executors/file-server',
  '/web/package': '/packages/web/executors/rollup',
  '/angular/application': '/packages/angular/generators/application',
  '/angular/convert-tslint-to-eslint':
    '/packages/angular/generators/convert-tslint-to-eslint',
  '/angular/downgrade-module': '/packages/angular/generators/downgrade-module',
  '/angular/karma': '/packages/angular/generators/karma',
  '/angular/karma-project': '/packages/angular/generators/karma-project',
  '/angular/library': '/packages/angular/generators/library',
  '/angular/library-secondary-entry-point':
    '/packages/angular/generators/library-secondary-entry-point',
  '/angular/mfe-host': '/packages/angular/generators/mfe-host',
  '/angular/mfe-remote': '/packages/angular/generators/mfe-remote',
  '/angular/move': '/packages/angular/generators/move',
  '/angular/ngrx': '/packages/angular/generators/ngrx',
  '/angular/scam': '/packages/angular/generators/scam',
  '/angular/scam-directive': '/packages/angular/generators/scam-directive',
  '/angular/scam-pipe': '/packages/angular/generators/scam-pipe',
  '/angular/setup-mfe': '/packages/angular/generators/setup-mfe',
  '/angular/setup-tailwind': '/packages/angular/generators/setup-tailwind',
  '/angular/stories': '/packages/angular/generators/stories',
  '/angular/storybook-configuration':
    '/packages/angular/generators/storybook-configuration',
  '/angular/upgrade-module': '/packages/angular/generators/upgrade-module',
  '/angular/web-worker': '/packages/angular/generators/web-worker',
  '/angular/delegate-build': '/packages/angular/executors/delegate-build',
  '/angular/ng-packagr-lite': '/packages/angular/executors/ng-packagr-lite',
  '/angular/package': '/packages/angular/executors/package',
  '/angular/webpack-browser': '/packages/angular/executors/webpack-browser',
  '/angular/webpack-server': '/packages/angular/executors/webpack-server',
  '/react/application': '/packages/react/generators/application',
  '/react/component': '/packages/react/generators/component',
  '/react/component-cypress-spec':
    '/packages/react/generators/component-cypress-spec',
  '/react/component-story': '/packages/react/generators/component-story',
  '/react/library': '/packages/react/generators/library',
  '/react/redux': '/packages/react/generators/redux',
  '/react/stories': '/packages/react/generators/stories',
  '/react/storybook-configuration':
    '/packages/react/generators/storybook-configuration',
  '/react/hook': '/packages/react/generators/hook',
  '/jest/jest': '/packages/jest/executors/jest',
  '/cypress/cypress': '/packages/cypress/executors/cypress',
  '/cypress/cypress-project': '/packages/cypress/generators/cypress-project',
  '/storybook/configuration': '/packages/storybook/generators/configuration',
  '/storybook/cypress-project':
    '/packages/storybook/generators/cypress-project',
  '/storybook/migrate-defaults-5-to-6':
    '/packages/storybook/generators/migrate-defaults-5-to-6',
  '/storybook/migrate-stories-to-6-2':
    '/packages/storybook/generators/migrate-stories-to-6-2',
  '/storybook/executors-build': '/packages/storybook/executors/build',
  '/storybook/executors-storybook': '/packages/storybook/executors/storybook',
  '/linter/eslint': '/packages/linter/executors/eslint',
  '/linter/lint': '/packages/linter/executors/lint',
  '/linter/workspace-rule': '/packages/linter/generators/workspace-rule',
  '/node/application': '/packages/node/generators/application',
  '/node/library': '/packages/node/generators/library',
  '/node/webpack': '/packages/node/executors/webpack',
  '/node/node': '/packages/node/executors/node',
  '/express/application': '/packages/express/generators/application',
  '/nest/application': '/packages/nest/generators/application',
  '/nest/class': '/packages/nest/generators/class',
  '/nest/controller': '/packages/nest/generators/controller',
  '/nest/decorator': '/packages/nest/generators/decorator',
  '/nest/filter': '/packages/nest/generators/filter',
  '/nest/gateway': '/packages/nest/generators/gateway',
  '/nest/guard': '/packages/nest/generators/guard',
  '/nest/interceptor': '/packages/nest/generators/interceptor',
  '/nest/interface': '/packages/nest/generators/interface',
  '/nest/library': '/packages/nest/generators/library',
  '/nest/middleware': '/packages/nest/generators/middleware',
  '/nest/module': '/packages/nest/generators/module',
  '/nest/pipe': '/packages/nest/generators/pipe',
  '/nest/provider': '/packages/nest/generators/provider',
  '/nest/resolver': '/packages/nest/generators/resolver',
  '/nest/resource': '/packages/nest/generators/resource',
  '/nest/service': '/packages/nest/generators/service',
  '/nest/convert-tslint-to-eslint':
    '/packages/nest/generators/convert-tslint-to-eslint',
  '/next/application': '/packages/next/generators/application',
  '/next/component': '/packages/next/generators/component',
  '/next/page': '/packages/next/generators/page',
  '/next/build': '/packages/next/executors/build',
  '/next/server': '/packages/next/executors/server',
  '/next/export': '/packages/next/executors/export',
  '/detox/application': '/packages/detox/generators/application',
  '/detox/build': '/packages/detox/executors/build',
  '/detox/test': '/packages/detox/executors/test',
  '/react-native/application': '/packages/react-native/generators/application',
  '/react-native/component': '/packages/react-native/generators/component',
  '/react-native/library': '/packages/react-native/generators/library',
  '/react-native/component-story':
    '/packages/react-native/generators/component-story',
  '/react-native/stories': '/packages/react-native/generators/stories',
  '/react-native/storybook-configuration':
    '/packages/react-native/generators/storybook-configuration',
  '/react-native/build-android':
    '/packages/react-native/executors/build-android',
  '/react-native/bundle': '/packages/react-native/executors/bundle',
  '/react-native/ensure-symlink':
    '/packages/react-native/executors/ensure-symlink',
  '/react-native/run-android': '/packages/react-native/executors/run-android',
  '/react-native/run-ios': '/packages/react-native/executors/run-ios',
  '/react-native/start': '/packages/react-native/executors/start',
  '/react-native/storybook': '/packages/react-native/executors/storybook',
  '/react-native/sync-deps': '/packages/react-native/executors/sync-deps',
  '/nx-plugin/executor': '/packages/nx-plugin/generators/executor',
  '/nx-plugin/migration': '/packages/nx-plugin/generators/migration',
  '/nx-plugin/plugin': '/packages/nx-plugin/generators/plugin',
  '/nx-plugin/schematic': '/packages/nx-plugin/generators/generator',
  '/nx-plugin/e2e': '/packages/nx-plugin/executors/e2e',
  '/nx-devkit/index': '/packages/nx-devkit/index',
  '/nx-devkit/ngcli_adapter': '/packages/nx-devkit/ngcli_adapter',
};

/**
 * Guide specific rules (added 2022-01-04)
 */
const guideUrls = {
  '/core-concepts/configuration': '/configuration/projectjson',
  '/core-concepts/mental-model': '/using-nx/mental-model',
  '/core-concepts/updating-nx': '/using-nx/updating-nx',
  '/core-concepts/ci-overview': '/using-nx/ci-overview',
  '/getting-started/nx-cli': '/using-nx/nx-cli',
  '/getting-started/console': '/using-nx/console',
  '/core-extended/affected': '/using-nx/affected',
  '/core-extended/computation-caching': '/using-nx/caching',
  '/guides/nextjs': '/next/overview',
  '/using-nx/nx-devkit': '/extending-nx/nx-devkit',
  '/structure/project-graph-plugins': '/extending-nx/project-graph-plugins',
};

/**
 * Public export API
 */
module.exports = {
  schemaUrls,
  guideUrls,
};
