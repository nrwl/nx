/*
 * We present a different grouping or naming for the API docs compared to their package names.
 * - pagePath - the path to the package's API docs page
 * - includeDocuments - whether to include documents, which should eventually be moved to guides
 *
 * This mapping is used in:
 * - scripts/documentation/generators/generate-manifests.ts (generate menus)
 * - nx-dev/data-access-documents/src/lib/documents.api.ts (generate page urls)
 * - nx-dev/nx-dev/pages/[...segments].tsx (generate page content)
 */
export const pkgToGeneratedApiDocs: Record<
  string,
  { pagePath: string; introPath: string; includeDocuments?: boolean }
> = {
  // ts/js
  js: {
    pagePath: '/technologies/typescript/api',
    introPath: '/technologies/typescript/introduction',
  },
  // angular
  angular: {
    pagePath: '/technologies/angular/api',
    introPath: '/technologies/angular/introduction',
  },
  // react
  react: {
    pagePath: '/technologies/react/api',
    introPath: '/technologies/react/introduction',
  },
  'react-native': {
    pagePath: '/technologies/react/react-native/api',
    introPath: '/technologies/react/react-native/introduction',
  },
  expo: {
    pagePath: '/technologies/react/expo/api',
    introPath: '/technologies/react/expo/introduction',
  },
  next: {
    pagePath: '/technologies/react/next/api',
    introPath: '/technologies/react/next/introduction',
  },
  remix: {
    pagePath: '/technologies/react/remix/api',
    introPath: '/technologies/react/remix/introduction',
  },
  // vue
  vue: {
    pagePath: '/technologies/vue/api',
    introPath: '/technologies/vue/introduction',
  },
  nuxt: {
    pagePath: '/technologies/vue/nuxt/api',
    introPath: '/technologies/vue/nuxt/introduction',
  },
  // node
  node: {
    pagePath: '/technologies/node/api',
    introPath: '/technologies/node/introduction',
  },
  express: {
    pagePath: '/technologies/node/express/api',
    introPath: '/technologies/node/express/introduction',
  },
  nest: {
    pagePath: '/technologies/node/nest/api',
    introPath: '/technologies/node/nest/introduction',
  },
  // java
  gradle: {
    pagePath: '/technologies/java/api',
    introPath: '/technologies/java/introduction',
  },
  // build tools
  webpack: {
    pagePath: '/technologies/build-tools/webpack/api',
    introPath: '/technologies/build-tools/webpack/introduction',
  },
  vite: {
    pagePath: '/technologies/build-tools/vite/api',
    introPath: '/technologies/build-tools/vite/introduction',
  },
  rollup: {
    pagePath: '/technologies/build-tools/rollup/api',
    introPath: '/technologies/build-tools/rollup/introduction',
  },
  esbuild: {
    pagePath: '/technologies/build-tools/esbuild/api',
    introPath: '/technologies/build-tools/esbuild/introduction',
  },
  rspack: {
    pagePath: '/technologies/build-tools/rspack/api',
    introPath: '/technologies/build-tools/rspack/introduction',
  },
  rsbuild: {
    pagePath: '/technologies/build-tools/rsbuild/api',
    introPath: '/technologies/build-tools/rsbuild/introduction',
  },
  // test tools
  jest: {
    pagePath: '/technologies/test-tools/jest/api',
    introPath: '/technologies/test-tools/jest/introduction',
  },
  storybook: {
    pagePath: '/technologies/test-tools/storybook/api',
    introPath: '/technologies/test-tools/storybook/introduction',
  },
  playwright: {
    pagePath: '/technologies/test-tools/playwright/api',
    introPath: '/technologies/test-tools/playwright/introduction',
  },
  cypress: {
    pagePath: '/technologies/test-tools/cypress/api',
    introPath: '/technologies/test-tools/cypress/introduction',
  },
  detox: {
    pagePath: '/technologies/test-tools/detox/api',
    introPath: '/technologies/test-tools/detox/introduction',
  },
  // misc
  'module-federation': {
    pagePath: '/technologies/module-federation/api',
    introPath: '/technologies/module-federation/introduction',
  },
  eslint: {
    pagePath: '/technologies/eslint/api',
    introPath: '/technologies/eslint/introduction',
  },
  'eslint-plugin': {
    pagePath: '/technologies/eslint/eslint-plugin/api',
    introPath: '/technologies/eslint/eslint-plugin/api',
  },
  // core and misc
  // For now, things that are not in technologies are put here in references/core-api
  nx: {
    pagePath: '/reference/core-api/nx',
    introPath: '/reference/core-api/nx',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  workspace: {
    pagePath: '/reference/core-api/workspace',
    introPath: '/reference/core-api/workspace',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  owners: {
    pagePath: '/reference/core-api/owners',
    introPath: '/reference/core-api/owners',
  },
  conformance: {
    pagePath: '/reference/core-api/conformance',
    introPath: '/reference/core-api/conformance',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  'azure-cache': {
    pagePath: '/reference/core-api/azure-cache',
    introPath: '/reference/core-api/azure-cache',
  },
  'gcs-cache': {
    pagePath: '/reference/core-api/gcs-cache',
    introPath: '/reference/core-api/gcs-cache',
  },
  's3-cache': {
    pagePath: '/reference/core-api/s3-cache',
    introPath: '/reference/core-api/s3-cache',
  },
  'shared-fs-cache': {
    pagePath: '/reference/core-api/shared-fs-cache',
    introPath: '/reference/core-api/shared-fs-cache',
  },
  devkit: {
    pagePath: '/reference/core-api/devkit',
    introPath: '/reference/core-api/devkit/documents/nx_devkit',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  plugin: {
    pagePath: '/reference/core-api/plugin',
    introPath: '/reference/core-api/plugin',
  },
  web: {
    pagePath: '/reference/core-api/web',
    introPath: '/reference/core-api/web',
  },
};
