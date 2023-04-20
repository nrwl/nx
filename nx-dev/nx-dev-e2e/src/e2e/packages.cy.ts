import { assertTextOnPage } from './helpers';

/**
 * Asserting all the packages pages are accounted for and accessible.
 * Generation of the pages is manual since we want to make sure the change is intended.
 */
describe('nx-dev: Packages Section', () => {
  (<{ title: string; path: string }[]>[
    { title: '@nx/angular', path: '/packages/angular' },
    {
      title: '@nx/angular:add-linting',
      path: '/packages/angular/generators/add-linting',
    },
    {
      title: '@nx/angular:application',
      path: '/packages/angular/generators/application',
    },
    {
      title: '@nx/angular:component',
      path: '/packages/angular/generators/component',
    },
    {
      title: '@nx/angular:component-cypress-spec',
      path: '/packages/angular/generators/component-cypress-spec',
    },
    {
      title: '@nx/angular:component-story',
      path: '/packages/angular/generators/component-story',
    },
    {
      title: '@nx/angular:convert-tslint-to-eslint',
      path: '/packages/angular/generators/convert-tslint-to-eslint',
    },
    { title: '@nx/angular:init', path: '/packages/angular/generators/init' },
    {
      title: '@nx/angular:library',
      path: '/packages/angular/generators/library',
    },
    {
      title: '@nx/angular:library-secondary-entry-point',
      path: '/packages/angular/generators/library-secondary-entry-point',
    },
    {
      title: '@nx/angular:remote',
      path: '/packages/angular/generators/remote',
    },
    { title: '@nx/angular:move', path: '/packages/angular/generators/move' },
    {
      title: '@nx/angular:convert-to-with-mf',
      path: '/packages/angular/generators/convert-to-with-mf',
    },
    { title: '@nx/angular:host', path: '/packages/angular/generators/host' },
    {
      title: '@nx/angular:ng-add',
      path: '/packages/angular/generators/ng-add',
    },
    { title: '@nx/angular:ngrx', path: '/packages/angular/generators/ngrx' },
    { title: '@nx/angular:scam', path: '/packages/angular/generators/scam' },
    {
      title: '@nx/angular:scam-directive',
      path: '/packages/angular/generators/scam-directive',
    },
    {
      title: '@nx/angular:scam-pipe',
      path: '/packages/angular/generators/scam-pipe',
    },
    {
      title: '@nx/angular:setup-mf',
      path: '/packages/angular/generators/setup-mf',
    },
    {
      title: '@nx/angular:setup-tailwind',
      path: '/packages/angular/generators/setup-tailwind',
    },
    {
      title: '@nx/angular:stories',
      path: '/packages/angular/generators/stories',
    },
    {
      title: '@nrwl/',
      path: '/packages/angular/generators/storybook-configuration',
    },
    {
      title: '@nx/angular:web-worker',
      path: '/packages/angular/generators/web-worker',
    },
    {
      title: '@nx/angular:delegate-build',
      path: '/packages/angular/executors/delegate-build',
    },
    {
      title: '@nx/angular:ng-packagr-lite',
      path: '/packages/angular/executors/ng-packagr-lite',
    },
    {
      title: '@nx/angular:package',
      path: '/packages/angular/executors/package',
    },
    { title: 'create-nx-plugin', path: '/packages/create-nx-plugin' },
    {
      title: 'create-nx-workspace',
      path: '/packages/create-nx-workspace',
    },
    { title: '@nx/cypress', path: '/packages/cypress' },
    { title: '@nx/cypress:init', path: '/packages/cypress/generators/init' },
    {
      title: '@nx/cypress:cypress-project',
      path: '/packages/cypress/generators/cypress-project',
    },
    {
      title: '@nx/cypress:cypress',
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
    { title: '@nx/devkit', path: '/packages/devkit' },
    { title: '@nrwl/esbuild', path: '/packages/esbuild' },
    {
      title: '@nrwl/esbuild:esbuild',
      path: '/packages/esbuild/executors/esbuild',
    },
    { title: '@nrwl/eslint-plugin', path: '/packages/eslint-plugin' },
    { title: '@nrwl/expo', path: '/packages/expo' },
    {
      title: '@nrwl/expo:init',
      path: '/packages/expo/generators/init',
    },
    {
      title: '@nrwl/expo:application',
      path: '/packages/expo/generators/application',
    },
    {
      title: '@nrwl/expo:library',
      path: '/packages/expo/generators/library',
    },
    {
      title: '@nrwl/expo:component',
      path: '/packages/expo/generators/component',
    },
    {
      title: '@nrwl/expo:start',
      path: '/packages/expo/executors/start',
    },
    {
      title: '@nrwl/expo:sync-deps',
      path: '/packages/expo/executors/sync-deps',
    },
    {
      title: '@nrwl/expo:ensure-symlink',
      path: '/packages/expo/executors/ensure-symlink',
    },
    { title: '@nrwl/express', path: '/packages/express' },
    { title: '@nrwl/express:init', path: '/packages/express/generators/init' },
    {
      title: '@nrwl/express:application',
      path: '/packages/express/generators/application',
    },
    { title: '@nx/jest', path: '/packages/jest' },
    { title: '@nx/jest:init', path: '/packages/jest/generators/init' },
    {
      title: '@nx/jest:jest-project',
      path: '/packages/jest/generators/jest-project',
    },
    { title: '@nx/jest', path: '/packages/jest/executors/jest' },
    { title: '@nx/js', path: '/packages/js' },
    { title: '@nx/js:library', path: '/packages/js/generators/library' },
    { title: '@nx/js:init', path: '/packages/js/generators/init' },
    {
      title: '@nx/js:convert-to-swc',
      path: '/packages/js/generators/convert-to-swc',
    },
    { title: '@nx/js:tsc', path: '/packages/js/executors/tsc' },
    { title: '@nx/js:swc', path: '/packages/js/executors/swc' },
    { title: '@nx/linter', path: '/packages/linter' },
    {
      title: '@nx/linter:workspace-rules-project',
      path: '/packages/linter/generators/workspace-rules-project',
    },
    {
      title: '@nx/linter',
      path: '/packages/linter/generators/workspace-rule',
    },
    { title: '@nx/linter', path: '/packages/linter/executors/eslint' },
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
    { title: '@nx/next', path: '/packages/next' },
    { title: '@nx/next:init', path: '/packages/next/generators/init' },
    {
      title: '@nx/next:application',
      path: '/packages/next/generators/application',
    },
    { title: '@nx/next:page', path: '/packages/next/generators/page' },
    {
      title: '@nx/next:component',
      path: '/packages/next/generators/component',
    },
    { title: '@nx/next:library', path: '/packages/next/generators/library' },
    { title: '@nx/next:build', path: '/packages/next/executors/build' },
    { title: '@nx/next:server', path: '/packages/next/executors/server' },
    { title: '@nx/next:export', path: '/packages/next/executors/export' },
    { title: '@nrwl/node', path: '/packages/node' },
    { title: '@nrwl/node:init', path: '/packages/node/generators/init' },
    {
      title: '@nrwl/node:application',
      path: '/packages/node/generators/application',
    },
    { title: '@nrwl/node:library', path: '/packages/node/generators/library' },
    { title: '@nrwl/node:node', path: '/packages/node/executors/node' },
    { title: 'nx', path: '/packages/nx' },
    { title: 'nx:noop', path: '/packages/nx/executors/noop' },
    {
      title: 'nx:run-commands',
      path: '/packages/nx/executors/run-commands',
    },
    { title: 'nx:run-script', path: '/packages/nx/executors/run-script' },
    { title: 'nx-plugin', path: '/packages/plugin' },
    {
      title: '@nrwl/nx-plugin:plugin',
      path: '/packages/plugin/generators/plugin',
    },
    {
      title: '@nrwl/nx-plugin:e2e-project',
      path: '/packages/plugin/generators/e2e-project',
    },
    {
      title: '@nrwl/nx-plugin:migration',
      path: '/packages/plugin/generators/migration',
    },
    {
      title: '@nrwl/nx-plugin:generator',
      path: '/packages/plugin/generators/generator',
    },
    {
      title: '@nrwl/nx-plugin:executor',
      path: '/packages/plugin/generators/executor',
    },
    { title: '@nrwl/nx-plugin:e2e', path: '/packages/plugin/executors/e2e' },
    { title: '@nx/react', path: '/packages/react' },
    { title: '@nx/react:init', path: '/packages/react/generators/init' },
    {
      title: '@nx/react:application',
      path: '/packages/react/generators/application',
    },
    {
      title: '@nx/react:library',
      path: '/packages/react/generators/library',
    },
    {
      title: '@nx/react:component',
      path: '/packages/react/generators/component',
    },
    { title: '@nx/react:redux', path: '/packages/react/generators/redux' },
    {
      title: '@nx/react:storybook-configuration',
      path: '/packages/react/generators/storybook-configuration',
    },
    {
      title: '@nx/react:component-story',
      path: '/packages/react/generators/component-story',
    },
    {
      title: '@nx/react:stories',
      path: '/packages/react/generators/stories',
    },
    {
      title: '@nx/react:component-cypress-spec',
      path: '/packages/react/generators/component-cypress-spec',
    },
    { title: '@nx/react:hook', path: '/packages/react/generators/hook' },
    { title: '@nx/react:host', path: '/packages/react/generators/host' },
    { title: '@nx/react:remote', path: '/packages/react/generators/remote' },
    {
      title: '@nx/react:module-federation-dev-server',
      path: '/packages/react/executors/module-federation-dev-server',
    },
    { title: '@nx/react-native', path: '/packages/react-native' },
    {
      title: '@nx/react-native:init',
      path: '/packages/react-native/generators/init',
    },
    {
      title: '@nx/react-native:application',
      path: '/packages/react-native/generators/application',
    },
    {
      title: '@nx/react-native:library',
      path: '/packages/react-native/generators/library',
    },
    {
      title: '@nx/react-native:component',
      path: '/packages/react-native/generators/component',
    },
    {
      title: '@nrwl/',
      path: '/packages/react-native/generators/storybook-configuration',
    },
    {
      title: '@nx/react-native:component-story',
      path: '/packages/react-native/generators/component-story',
    },
    {
      title: '@nx/react-native:stories',
      path: '/packages/react-native/generators/stories',
    },
    {
      title: '@nx/react-native:upgrade-native',
      path: '/packages/react-native/generators/upgrade-native',
    },
    {
      title: '@nx/react-native:run-android',
      path: '/packages/react-native/executors/run-android',
    },
    {
      title: '@nx/react-native:run-ios',
      path: '/packages/react-native/executors/run-ios',
    },
    {
      title: '@nx/react-native:bundle',
      path: '/packages/react-native/executors/bundle',
    },
    {
      title: '@nx/react-native:build-android',
      path: '/packages/react-native/executors/build-android',
    },
    {
      title: '@nx/react-native:start',
      path: '/packages/react-native/executors/start',
    },
    {
      title: '@nx/react-native:sync-deps',
      path: '/packages/react-native/executors/sync-deps',
    },
    {
      title: '@nx/react-native:ensure-symlink',
      path: '/packages/react-native/executors/ensure-symlink',
    },
    {
      title: '@nx/react-native:storybook',
      path: '/packages/react-native/executors/storybook',
    },
    { title: '@nx/storybook', path: '/packages/storybook' },
    {
      title: '@nx/storybook:init',
      path: '/packages/storybook/generators/init',
    },
    {
      title: '@nx/storybook:configuration',
      path: '/packages/storybook/generators/configuration',
    },
    {
      title: '@nx/storybook:cypress-project',
      path: '/packages/storybook/generators/cypress-project',
    },
    {
      title: '@nx/storybook:storybook',
      path: '/packages/storybook/executors/storybook',
    },
    {
      title: '@nx/storybook:build',
      path: '/packages/storybook/executors/build',
    },
    { title: '@nrwl/tao', path: '/packages/tao' },
    { title: '@nx/web', path: '/packages/web' },
    { title: '@nx/web:init', path: '/packages/web/generators/init' },
    {
      title: '@nx/web:application',
      path: '/packages/web/generators/application',
    },
    {
      title: '@nx/web:file-server',
      path: '/packages/web/executors/file-server',
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
      title: '@nrwl/workspace:workspace-generator',
      path: '/packages/workspace/generators/workspace-generator',
    },
    {
      title: '@nrwl/workspace:run-command',
      path: '/packages/workspace/generators/run-commands',
    },
    {
      title: '@nrwl/workspace:fix-configuration',
      path: '/packages/workspace/generators/fix-configuration',
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
      title: '@nrwl/workspace:counter',
      path: '/packages/workspace/executors/counter',
    },
  ]).forEach((page) => assertTextOnPage(page.path, page.title));
});
