import { assertTextOnPage } from './helpers';

/**
 * Asserting all the packages pages are accounted for and accessible.
 * Generation of the pages is manual since we want to make sure the change is intended.
 */
describe('nx-dev: Packages Section', () => {
  (<{ title: string; path: string }[]>[
    { title: '@nrwl/', path: '/packages/angular' },
    {
      title: '@nrwl/angular:add-linting',
      path: '/packages/angular/generators/add-linting',
    },
    {
      title: '@nrwl/angular:application',
      path: '/packages/angular/generators/application',
    },
    {
      title: '@nrwl/angular:component',
      path: '/packages/angular/generators/component',
    },
    {
      title: '@nrwl/angular:component-cypress-spec',
      path: '/packages/angular/generators/component-cypress-spec',
    },
    {
      title: '@nrwl/angular:component-story',
      path: '/packages/angular/generators/component-story',
    },
    {
      title: '@nrwl/angular:convert-tslint-to-eslint',
      path: '/packages/angular/generators/convert-tslint-to-eslint',
    },
    {
      title: '@nrwl/angular:downgrade-module',
      path: '/packages/angular/generators/downgrade-module',
    },
    { title: '@nrwl/angular:init', path: '/packages/angular/generators/init' },
    {
      title: '@nrwl/angular:karma',
      path: '/packages/angular/generators/karma',
    },
    {
      title: '@nrwl/angular:karma-project',
      path: '/packages/angular/generators/karma-project',
    },
    {
      title: '@nrwl/angular:library',
      path: '/packages/angular/generators/library',
    },
    {
      title: '@nrwl/angular:library-secondary-entry-point',
      path: '/packages/angular/generators/library-secondary-entry-point',
    },
    {
      title: '@nrwl/angular:remote',
      path: '/packages/angular/generators/remote',
    },
    { title: '@nrwl/angular:move', path: '/packages/angular/generators/move' },
    {
      title: '@nrwl/angular:convert-to-with-mf',
      path: '/packages/angular/generators/convert-to-with-mf',
    },
    { title: '@nrwl/angular:host', path: '/packages/angular/generators/host' },
    {
      title: '@nrwl/angular:ng-add',
      path: '/packages/angular/generators/ng-add',
    },
    { title: '@nrwl/angular:ngrx', path: '/packages/angular/generators/ngrx' },
    { title: '@nrwl/angular:scam', path: '/packages/angular/generators/scam' },
    {
      title: '@nrwl/angular:scam-directive',
      path: '/packages/angular/generators/scam-directive',
    },
    {
      title: '@nrwl/angular:scam-pipe',
      path: '/packages/angular/generators/scam-pipe',
    },
    {
      title: '@nrwl/angular:setup-mfe',
      path: '/packages/angular/generators/setup-mfe',
    },
    {
      title: '@nrwl/angular:setup-tailwind',
      path: '/packages/angular/generators/setup-tailwind',
    },
    {
      title: '@nrwl/angular:stories',
      path: '/packages/angular/generators/stories',
    },
    {
      title: '@nrwl/',
      path: '/packages/angular/generators/storybook-configuration',
    },
    {
      title: '@nrwl/angular:upgrade-module',
      path: '/packages/angular/generators/upgrade-module',
    },
    {
      title: '@nrwl/angular:web-worker',
      path: '/packages/angular/generators/web-worker',
    },
    {
      title: '@nrwl/angular:delegate-build',
      path: '/packages/angular/executors/delegate-build',
    },
    {
      title: '@nrwl/angular:ng-packagr-lite',
      path: '/packages/angular/executors/ng-packagr-lite',
    },
    {
      title: '@nrwl/angular:package',
      path: '/packages/angular/executors/package',
    },
    {
      title: '@nrwl/angular:webpack-browser',
      path: '/packages/angular/executors/webpack-browser',
    },
    {
      title: '@nrwl/angular:webpack-server',
      path: '/packages/angular/executors/webpack-server',
    },
    {
      title: '@nrwl/angular:module-federation-dev-server',
      path: '/packages/angular/executors/module-federation-dev-server',
    },
    {
      title: '@nrwl/angular:file-server',
      path: '/packages/angular/executors/file-server',
    },
    { title: '@nrwl/cli', path: '/packages/cli' },
    { title: '@nrwl/cra-to-nx', path: '/packages/cra-to-nx' },
    { title: '@nrwl/create-nx-plugin', path: '/packages/create-nx-plugin' },
    {
      title: '@nrwl/create-nx-workspace',
      path: '/packages/create-nx-workspace',
    },
    { title: '@nrwl/cypress', path: '/packages/cypress' },
    { title: '@nrwl/cypress:init', path: '/packages/cypress/generators/init' },
    {
      title: '@nrwl/cypress:cypress-project',
      path: '/packages/cypress/generators/cypress-project',
    },
    {
      title: '@nrwl/cypress:cypress',
      path: '/packages/cypress/executors/cypress',
    },
    { title: '@nrwl/detox', path: '/packages/detox' },
    { title: '@nrwl/detox:init', path: '/packages/detox/generators/init' },
    {
      title: '@nrwl/detox:application',
      path: '/packages/detox/generators/application',
    },
    { title: '@nrwl/detox:build', path: '/packages/detox/executors/build' },
    { title: '@nrwl/detox:test', path: '/packages/detox/executors/test' },
    { title: '@nrwl/devkit', path: '/packages/devkit' },
    { title: '@nrwl/eslint-plugin-nx', path: '/packages/eslint-plugin-nx' },
    { title: '@nrwl/express', path: '/packages/express' },
    { title: '@nrwl/express:init', path: '/packages/express/generators/init' },
    {
      title: '@nrwl/express:application',
      path: '/packages/express/generators/application',
    },
    { title: '@nrwl/jest', path: '/packages/jest' },
    { title: '@nrwl/jest:init', path: '/packages/jest/generators/init' },
    {
      title: '@nrwl/jest:jest-project',
      path: '/packages/jest/generators/jest-project',
    },
    { title: '@nrwl/jest', path: '/packages/jest/executors/jest' },
    { title: '@nrwl/js', path: '/packages/js' },
    { title: '@nrwl/js:library', path: '/packages/js/generators/library' },
    { title: '@nrwl/js:init', path: '/packages/js/generators/init' },
    {
      title: '@nrwl/js:convert-to-swc',
      path: '/packages/js/generators/convert-to-swc',
    },
    { title: '@nrwl/js:tsc', path: '/packages/js/executors/tsc' },
    { title: '@nrwl/js:swc', path: '/packages/js/executors/swc' },
    { title: '@nrwl/linter', path: '/packages/linter' },
    {
      title: '@nrwl/linter:workspace-rules-project',
      path: '/packages/linter/generators/workspace-rules-project',
    },
    {
      title: '@nrwl/linter',
      path: '/packages/linter/generators/workspace-rule',
    },
    { title: '@nrwl/linter', path: '/packages/linter/executors/lint' },
    { title: '@nrwl/linter', path: '/packages/linter/executors/eslint' },
    {
      title: '@nrwl/make-angular-cli-faster',
      path: '/packages/make-angular-cli-faster',
    },
    { title: '@nrwl/nest', path: '/packages/nest' },
    {
      title: '@nrwl/nest:application',
      path: '/packages/nest/generators/application',
    },
    {
      title: '@nrwl/nest:convert-tslint-to-eslint',
      path: '/packages/nest/generators/convert-tslint-to-eslint',
    },
    { title: '@nrwl/nest:init', path: '/packages/nest/generators/init' },
    { title: '@nrwl/nest:library', path: '/packages/nest/generators/library' },
    { title: '@nrwl/nest:class', path: '/packages/nest/generators/class' },
    {
      title: '@nrwl/nest:controller',
      path: '/packages/nest/generators/controller',
    },
    {
      title: '@nrwl/nest:decorator',
      path: '/packages/nest/generators/decorator',
    },
    { title: '@nrwl/nest:filter', path: '/packages/nest/generators/filter' },
    { title: '@nrwl/nest:gateway', path: '/packages/nest/generators/gateway' },
    { title: '@nrwl/nest:guard', path: '/packages/nest/generators/guard' },
    {
      title: '@nrwl/nest:interceptor',
      path: '/packages/nest/generators/interceptor',
    },
    {
      title: '@nrwl/nest:interface',
      path: '/packages/nest/generators/interface',
    },
    {
      title: '@nrwl/nest:middleware',
      path: '/packages/nest/generators/middleware',
    },
    { title: '@nrwl/nest:module', path: '/packages/nest/generators/module' },
    { title: '@nrwl/nest:pipe', path: '/packages/nest/generators/pipe' },
    {
      title: '@nrwl/nest:provider',
      path: '/packages/nest/generators/provider',
    },
    {
      title: '@nrwl/nest:resolver',
      path: '/packages/nest/generators/resolver',
    },
    {
      title: '@nrwl/nest:resource',
      path: '/packages/nest/generators/resource',
    },
    { title: '@nrwl/nest:service', path: '/packages/nest/generators/service' },
    { title: '@nrwl/next', path: '/packages/next' },
    { title: '@nrwl/next:init', path: '/packages/next/generators/init' },
    {
      title: '@nrwl/next:application',
      path: '/packages/next/generators/application',
    },
    { title: '@nrwl/next:page', path: '/packages/next/generators/page' },
    {
      title: '@nrwl/next:component',
      path: '/packages/next/generators/component',
    },
    { title: '@nrwl/next:library', path: '/packages/next/generators/library' },
    { title: '@nrwl/next:build', path: '/packages/next/executors/build' },
    { title: '@nrwl/next:server', path: '/packages/next/executors/server' },
    { title: '@nrwl/next:export', path: '/packages/next/executors/export' },
    { title: '@nrwl/node', path: '/packages/node' },
    { title: '@nrwl/node:init', path: '/packages/node/generators/init' },
    {
      title: '@nrwl/node:application',
      path: '/packages/node/generators/application',
    },
    { title: '@nrwl/node:library', path: '/packages/node/generators/library' },
    { title: '@nrwl/node:webpack', path: '/packages/node/executors/webpack' },
    { title: '@nrwl/node:node', path: '/packages/node/executors/node' },
    { title: 'nx', path: '/packages/nx' },
    { title: 'nx:noop', path: '/packages/nx/executors/noop' },
    {
      title: 'nx:run-commands',
      path: '/packages/nx/executors/run-commands',
    },
    { title: 'nx:run-script', path: '/packages/nx/executors/run-script' },
    { title: 'nx-plugin', path: '/packages/nx-plugin' },
    {
      title: '@nrwl/nx-plugin:plugin',
      path: '/packages/nx-plugin/generators/plugin',
    },
    {
      title: '@nrwl/nx-plugin:e2e-project',
      path: '/packages/nx-plugin/generators/e2e-project',
    },
    {
      title: '@nrwl/nx-plugin:migration',
      path: '/packages/nx-plugin/generators/migration',
    },
    {
      title: '@nrwl/nx-plugin:generator',
      path: '/packages/nx-plugin/generators/generator',
    },
    {
      title: '@nrwl/nx-plugin:executor',
      path: '/packages/nx-plugin/generators/executor',
    },
    { title: '@nrwl/nx-plugin:e2e', path: '/packages/nx-plugin/executors/e2e' },
    { title: '@nrwl/react', path: '/packages/react' },
    { title: '@nrwl/react:init', path: '/packages/react/generators/init' },
    {
      title: '@nrwl/react:application',
      path: '/packages/react/generators/application',
    },
    {
      title: '@nrwl/react:library',
      path: '/packages/react/generators/library',
    },
    {
      title: '@nrwl/react:component',
      path: '/packages/react/generators/component',
    },
    { title: '@nrwl/react:redux', path: '/packages/react/generators/redux' },
    {
      title: '@nrwl/react:storybook-configuration',
      path: '/packages/react/generators/storybook-configuration',
    },
    {
      title: '@nrwl/react:component-story',
      path: '/packages/react/generators/component-story',
    },
    {
      title: '@nrwl/react:stories',
      path: '/packages/react/generators/stories',
    },
    {
      title: '@nrwl/react:component-cypress-spec',
      path: '/packages/react/generators/component-cypress-spec',
    },
    { title: '@nrwl/react:hook', path: '/packages/react/generators/hook' },
    { title: '@nrwl/react:host', path: '/packages/react/generators/host' },
    { title: '@nrwl/react:remote', path: '/packages/react/generators/remote' },
    {
      title: '@nrwl/react:module-federation-dev-server',
      path: '/packages/react/executors/module-federation-dev-server',
    },
    { title: '@nrwl/react-native', path: '/packages/react-native' },
    {
      title: '@nrwl/react-native:init',
      path: '/packages/react-native/generators/init',
    },
    {
      title: '@nrwl/react-native:application',
      path: '/packages/react-native/generators/application',
    },
    {
      title: '@nrwl/react-native:library',
      path: '/packages/react-native/generators/library',
    },
    {
      title: '@nrwl/react-native:component',
      path: '/packages/react-native/generators/component',
    },
    {
      title: '@nrwl/',
      path: '/packages/react-native/generators/storybook-configuration',
    },
    {
      title: '@nrwl/react-native:component-story',
      path: '/packages/react-native/generators/component-story',
    },
    {
      title: '@nrwl/react-native:stories',
      path: '/packages/react-native/generators/stories',
    },
    {
      title: '@nrwl/react-native:upgrade-native',
      path: '/packages/react-native/generators/upgrade-native',
    },
    {
      title: '@nrwl/react-native:run-android',
      path: '/packages/react-native/executors/run-android',
    },
    {
      title: '@nrwl/react-native:run-ios',
      path: '/packages/react-native/executors/run-ios',
    },
    {
      title: '@nrwl/react-native:bundle',
      path: '/packages/react-native/executors/bundle',
    },
    {
      title: '@nrwl/react-native:build-android',
      path: '/packages/react-native/executors/build-android',
    },
    {
      title: '@nrwl/react-native:start',
      path: '/packages/react-native/executors/start',
    },
    {
      title: '@nrwl/react-native:sync-deps',
      path: '/packages/react-native/executors/sync-deps',
    },
    {
      title: '@nrwl/react-native:ensure-symlink',
      path: '/packages/react-native/executors/ensure-symlink',
    },
    {
      title: '@nrwl/react-native:storybook',
      path: '/packages/react-native/executors/storybook',
    },
    { title: '@nrwl/storybook', path: '/packages/storybook' },
    {
      title: '@nrwl/storybook:init',
      path: '/packages/storybook/generators/init',
    },
    {
      title: '@nrwl/storybook:configuration',
      path: '/packages/storybook/generators/configuration',
    },
    {
      title: '@nrwl/storybook:cypress-project',
      path: '/packages/storybook/generators/cypress-project',
    },
    {
      title: '@nrwl/storybook:storybook',
      path: '/packages/storybook/executors/storybook',
    },
    {
      title: '@nrwl/storybook:build',
      path: '/packages/storybook/executors/build',
    },
    { title: '@nrwl/tao', path: '/packages/tao' },
    { title: '@nrwl/web', path: '/packages/web' },
    { title: '@nrwl/web:init', path: '/packages/web/generators/init' },
    {
      title: '@nrwl/web:application',
      path: '/packages/web/generators/application',
    },
    { title: '@nrwl/web:webpack', path: '/packages/web/executors/webpack' },
    { title: '@nrwl/web:rollup', path: '/packages/web/executors/rollup' },
    {
      title: '@nrwl/web:dev-server',
      path: '/packages/web/executors/dev-server',
    },
    {
      title: '@nrwl/web:file-server',
      path: '/packages/web/executors/file-server',
    },
    { title: '@nrwl/workspace', path: '/packages/workspace' },
    {
      title: '@nrwl/workspace:workspace',
      path: '/packages/workspace/generators/workspace',
    },
    {
      title: '@nrwl/workspace:preset',
      path: '/packages/workspace/generators/preset',
    },
    {
      title: '@nrwl/workspace:move',
      path: '/packages/workspace/generators/move',
    },
    {
      title: '@nrwl/workspace:remove',
      path: '/packages/workspace/generators/remove',
    },
    {
      title: '@nrwl/workspace:new',
      path: '/packages/workspace/generators/new',
    },
    {
      title: '@nrwl/workspace:library',
      path: '/packages/workspace/generators/library',
    },
    {
      title: '@nrwl/workspace:workspace-generator',
      path: '/packages/workspace/generators/workspace-generator',
    },
    {
      title: '@nrwl/workspace:run-command',
      path: '/packages/workspace/generators/run-commands',
    },
    {
      title: '@nrwl/workspace:convert-to-nx-project',
      path: '/packages/workspace/generators/convert-to-nx-project',
    },
    {
      title: '@nrwl/workspace:npm-package',
      path: '/packages/workspace/generators/npm-package',
    },
    {
      title: '@nrwl/workspace:ci-workflow',
      path: '/packages/workspace/generators/ci-workflow',
    },
    {
      title: '@nrwl/workspace:run-commands',
      path: '/packages/workspace/executors/run-commands',
    },
    {
      title: '@nrwl/workspace:counter',
      path: '/packages/workspace/executors/counter',
    },
    {
      title: '@nrwl/workspace:run-script',
      path: '/packages/workspace/executors/run-script',
    },
  ]).forEach((page) => assertTextOnPage(page.path, page.title));
});
