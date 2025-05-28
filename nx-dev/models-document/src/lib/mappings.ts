/*
 * We present a different grouping or naming for the API docs compared to their package names.
 * - pagePath - the path to the package's API docs page
 * - menuPath - allows use to change the grouping without affecting the page path
 * - includeDocuments - whether to include documents, which should eventually be moved to guides
 *
 * This mapping is used in:
 * - scripts/documentation/generators/generate-manifests.ts (generate menus)
 * - nx-dev/data-access-documents/src/lib/documents.api.ts (generate page urls)
 * - nx-dev/nx-dev/pages/[...segments].tsx (generate page content)
 */
export const pkgToGeneratedApiDocs: Record<
  string,
  { pagePath: string; menuPath?: string; includeDocuments?: boolean }
> = {
  // ts/js
  js: {
    pagePath: '/technologies/typescript/api',
  },
  // angular
  angular: {
    pagePath: '/technologies/angular/api',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  // react
  react: {
    pagePath: '/technologies/react/api',
  },
  'react-native': {
    menuPath: '/technologies/react/react-native/api',
    pagePath: '/technologies/react-native/api',
  },
  expo: {
    menuPath: '/technologies/react/expo/api',
    pagePath: '/technologies/expo/api',
  },
  next: {
    menuPath: '/technologies/react/next/api',
    pagePath: '/technologies/next/api',
  },
  remix: {
    menuPath: '/technologies/react/remix/api',
    pagePath: '/technologies/remix/api',
  },
  // vue
  vue: {
    pagePath: '/technologies/vue/api',
  },
  nuxt: {
    menuPath: '/technologies/vue/nuxt/api',
    pagePath: '/technologies/nuxt/api',
  },
  // node
  node: {
    pagePath: '/technologies/node/api',
  },
  express: {
    menuPath: '/technologies/node/express/api',
    pagePath: '/technologies/express/api',
  },
  nest: {
    menuPath: '/technologies/node/nest/api',
    pagePath: '/technologies/nest/api',
  },
  // java
  gradle: {
    pagePath: '/technologies/java/api',
  },
  // build tools
  webpack: {
    menuPath: '/technologies/build-tools/webpack/api',
    pagePath: '/technologies/webpack/api',
  },
  vite: {
    menuPath: '/technologies/build-tools/vite/api',
    pagePath: '/technologies/vite/api',
  },
  rollup: {
    menuPath: '/technologies/build-tools/rollup/api',
    pagePath: '/technologies/rollup/api',
  },
  esbuild: {
    menuPath: '/technologies/build-tools/esbuild/api',
    pagePath: '/technologies/esbuild/api',
  },
  rspack: {
    menuPath: '/technologies/build-tools/rspack/api',
    pagePath: '/technologies/rspack/api',
  },
  rsbuild: {
    menuPath: '/technologies/build-tools/rsbuild/api',
    pagePath: '/technologies/rsbuild/api',
  },
  // test tools
  jest: {
    menuPath: '/technologies/test-tools/jest/api',
    pagePath: '/technologies/jest/api',
  },
  storybook: {
    menuPath: '/technologies/test-tools/storybook/api',
    pagePath: '/technologies/storybook/api',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  playwright: {
    menuPath: '/technologies/test-tools/playwright/api',
    pagePath: '/technologies/playwright/api',
  },
  cypress: {
    menuPath: '/technologies/test-tools/cypress/api',
    pagePath: '/technologies/cypress/api',
  },
  detox: {
    menuPath: '/technologies/test-tools/detox/api',
    pagePath: '/technologies/detox/api',
  },
  // misc
  'module-federation': {
    menuPath: '/technologies/module-federation/api',
    pagePath: '/technologies/module-federation/api',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  eslint: {
    pagePath: '/technologies/eslint/api',
  },
  'eslint-plugin': {
    menuPath: '/technologies/eslint/eslint-plugin/api',
    pagePath: '/technologies/eslint-plugin/api',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  // core and misc
  // For now, things that are not in technologies are put here in references/core-api
  nx: {
    pagePath: '/reference/core-api/nx',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  workspace: {
    pagePath: '/reference/core-api/workspace',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  owners: {
    pagePath: '/reference/core-api/owners',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  conformance: {
    pagePath: '/reference/core-api/conformance',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  'azure-cache': {
    pagePath: '/reference/core-api/azure-cache',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  'gcs-cache': {
    pagePath: '/reference/core-api/gcs-cache',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  's3-cache': {
    pagePath: '/reference/core-api/s3-cache',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  'shared-fs-cache': {
    pagePath: '/reference/core-api/shared-fs-cache',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  devkit: {
    pagePath: '/reference/core-api/devkit',
    // TODO(docs): move these to guides and remove this
    includeDocuments: true,
  },
  plugin: {
    pagePath: '/reference/core-api/plugin',
  },
  web: {
    pagePath: '/reference/core-api/web',
  },
};
