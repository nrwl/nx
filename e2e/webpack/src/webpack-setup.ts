import { cleanupProject, newProject } from '@nx/e2e-utils';


type NxPackage =
  | '@nx/angular'
  | '@nx/cypress'
  | '@nx/docker'
  | '@nx/eslint-plugin'
  | '@nx/express'
  | '@nx/esbuild'
  | '@nx/gradle'
  | '@nx/jest'
  | '@nx/js'
  | '@nx/eslint'
  | '@nx/nest'
  | '@nx/next'
  | '@nx/node'
  | '@nx/nuxt'
  | '@nx/plugin'
  | '@nx/playwright'
  | '@nx/rollup'
  | '@nx/react'
  | '@nx/remix'
  | '@nx/rspack'
  | '@nx/storybook'
  | '@nx/vue'
  | '@nx/vite'
  | '@nx/web'
  | '@nx/webpack'
  | '@nx/react-native'
  | '@nx/expo';

export function setupWebpackTest(packages?: readonly NxPackage[]) {
  beforeAll(() =>
    newProject({ packages: packages as Array<NxPackage> | undefined })
  );
  afterAll(() => cleanupProject());
}
