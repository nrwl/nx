import type { StarlightUserConfig } from '@astrojs/starlight/types';
import { getPluginItems } from './src/plugins/utils/plugin-mappings';

export const sidebar: StarlightUserConfig['sidebar'] = [
  // ============================================
  // 1. LEARN NX (only expanded section)
  // ============================================
  {
    label: 'Learn Nx',
    collapsed: false,
    items: [
      { label: 'Introduction', link: 'getting-started/intro' },
      {
        label: 'Start a New Project',
        link: 'getting-started/start-new-project',
      },
      {
        label: 'Add to Existing Project',
        link: 'getting-started/start-with-existing-project',
      },
      {
        label: 'Local Development',
        link: 'getting-started/local-development',
      },
      {
        label: 'Tutorials',
        collapsed: true,
        autogenerate: {
          directory: 'getting-started/Tutorials',
          collapsed: true,
        },
      },
      {
        label: 'Concepts',
        collapsed: true,
        items: [
          { label: 'Mental Model', link: 'concepts/mental-model' },
          { label: 'How Caching Works', link: 'concepts/how-caching-works' },
          {
            label: 'Task Pipelines',
            link: 'concepts/task-pipeline-configuration',
          },
          { label: 'Inferred Tasks', link: 'concepts/inferred-tasks' },
          { label: 'Nx Plugins', link: 'concepts/nx-plugins' },
        ],
      },
    ],
  },

  // ============================================
  // 2. BUILD WITH NX
  // ============================================
  {
    label: 'Build with Nx',
    collapsed: true,
    items: [
      // --- FEATURES (flattened, no Core wrapper) ---
      { label: 'Run Tasks', link: 'features/run-tasks' },
      { label: 'Cache Task Results', link: 'features/cache-task-results' },
      { label: 'Explore the Graph', link: 'features/explore-graph' },
      { label: 'Generate Code', link: 'features/generate-code' },
      { label: 'Manage Releases', link: 'features/manage-releases' },
      {
        label: 'Automate Updating Dependencies',
        link: 'features/automate-updating-dependencies',
      },
      { label: 'Enhance AI', link: 'features/enhance-ai' },
      { label: 'Nx MCP', link: 'features/nx-mcp' },

      // --- GUIDES (elevated, no longer nested under Core) ---
      {
        label: 'Guides',
        collapsed: true,
        items: [
          {
            label: 'Tasks & Caching',
            collapsed: true,
            autogenerate: {
              directory: 'guides/Tasks & Caching',
              collapsed: true,
            },
          },
          {
            label: 'Nx Release',
            collapsed: true,
            autogenerate: {
              directory: 'guides/Nx Release',
              collapsed: true,
            },
          },
          {
            label: 'Adopting Nx',
            collapsed: true,
            autogenerate: {
              directory: 'guides/Adopting Nx',
              collapsed: true,
            },
          },
          {
            label: 'Environment Variables',
            link: 'guides/define-environment-variables',
          },
          {
            label: 'Include Assets in Build',
            link: 'guides/include-assets-in-build',
          },
          { label: 'CI Deployment', link: 'guides/ci-deployment' },
        ],
      },

      // --- NX PACKAGES (dynamically injected via middleware) ---
      // Nx, Web, Workspace packages will be added here by sidebar-reference-updater.middleware.ts

      // --- TECHNOLOGIES ---
      {
        label: 'TypeScript',
        collapsed: true,
        items: [
          ...getPluginItems('js'),
          {
            label: 'Maintain TypeScript Monorepos',
            link: 'technologies/typescript/maintain-monorepos',
          },
        ],
      },
      {
        label: 'Angular',
        collapsed: true,
        items: [
          ...getPluginItems('angular'),
          {
            label: 'Angular Rspack',
            collapsed: true,
            items: getPluginItems('angular-rspack', 'angular'),
          },
          {
            label: 'Angular Rsbuild',
            collapsed: true,
            items: getPluginItems('angular-rsbuild', 'angular'),
          },
        ],
      },
      {
        label: 'React',
        collapsed: true,
        items: [
          ...getPluginItems('react'),
          {
            label: 'Next',
            collapsed: true,
            items: getPluginItems('next', 'react'),
          },
          {
            label: 'Remix',
            collapsed: true,
            items: getPluginItems('remix', 'react'),
          },
          {
            label: 'React Native',
            collapsed: true,
            items: getPluginItems('react-native', 'react'),
          },
          {
            label: 'Expo',
            collapsed: true,
            items: getPluginItems('expo', 'react'),
          },
        ],
      },
      {
        label: 'Vue',
        collapsed: true,
        items: [
          ...getPluginItems('vue'),
          {
            label: 'Nuxt',
            collapsed: true,
            items: getPluginItems('nuxt', 'vue'),
          },
        ],
      },
      {
        label: 'Node.js',
        collapsed: true,
        items: [
          ...getPluginItems('node'),
          {
            label: 'Express',
            collapsed: true,
            items: getPluginItems('express', 'node'),
          },
          {
            label: 'Nest',
            collapsed: true,
            items: getPluginItems('nest', 'node'),
          },
        ],
      },
      {
        label: 'Java',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/java/introduction',
          },
          {
            label: 'Gradle',
            collapsed: true,
            items: getPluginItems('gradle', 'java'),
          },
          {
            label: 'Maven',
            collapsed: true,
            items: getPluginItems('maven', 'java'),
          },
        ],
      },
      {
        label: '.NET',
        collapsed: true,
        items: getPluginItems('dotnet'),
      },
      {
        label: 'Module Federation',
        collapsed: true,
        items: getPluginItems('module-federation'),
      },
      {
        label: 'ESLint',
        collapsed: true,
        items: [
          ...getPluginItems('eslint'),
          {
            label: 'ESLint Plugin',
            collapsed: true,
            items: getPluginItems('eslint-plugin', 'eslint'),
          },
        ],
      },
      {
        label: 'Build Tools',
        collapsed: true,
        items: [
          {
            label: 'Webpack',
            collapsed: true,
            items: getPluginItems('webpack', 'build-tools'),
          },
          {
            label: 'Vite',
            collapsed: true,
            items: getPluginItems('vite', 'build-tools'),
          },
          {
            label: 'Rollup',
            collapsed: true,
            items: getPluginItems('rollup', 'build-tools'),
          },
          {
            label: 'ESBuild',
            collapsed: true,
            items: getPluginItems('esbuild', 'build-tools'),
          },
          {
            label: 'Rspack',
            collapsed: true,
            items: getPluginItems('rspack', 'build-tools'),
          },
          {
            label: 'Rsbuild',
            collapsed: true,
            items: getPluginItems('rsbuild', 'build-tools'),
          },
          {
            label: 'Docker',
            collapsed: true,
            items: getPluginItems('docker', 'build-tools'),
          },
        ],
      },
      {
        label: 'Test Tools',
        collapsed: true,
        items: [
          {
            label: 'Cypress',
            collapsed: true,
            items: getPluginItems('cypress', 'test-tools'),
          },
          {
            label: 'Vitest',
            collapsed: true,
            items: getPluginItems('vitest', 'test-tools'),
          },
          {
            label: 'Jest',
            collapsed: true,
            items: getPluginItems('jest', 'test-tools'),
          },
          {
            label: 'Playwright',
            collapsed: true,
            items: getPluginItems('playwright', 'test-tools'),
          },
          {
            label: 'Storybook',
            collapsed: true,
            items: getPluginItems('storybook', 'test-tools'),
          },
          {
            label: 'Detox',
            collapsed: true,
            items: getPluginItems('detox', 'test-tools'),
          },
        ],
      },
    ],
  },

  // ============================================
  // 3. SCALE WITH NX
  // ============================================
  {
    label: 'Scale with Nx',
    collapsed: true,
    items: [
      // Nx Cloud Introduction - elevated
      { label: 'Introduction', link: 'guides/nx-cloud/intro' },

      // CI Features - flattened (no longer nested)
      { label: 'Remote Caching', link: 'features/ci-features/remote-cache' },
      {
        label: 'Distributed Task Execution',
        link: 'features/ci-features/distribute-task-execution',
      },
      { label: 'Affected Commands', link: 'features/ci-features/affected' },
      {
        label: 'Flaky Task Detection',
        link: 'features/ci-features/flaky-tasks',
      },
      {
        label: 'Split E2E Tasks',
        link: 'features/ci-features/split-e2e-tasks',
      },
      {
        label: 'Self-Healing CI',
        link: 'features/ci-features/self-healing-ci',
      },
      { label: 'Dynamic Agents', link: 'features/ci-features/dynamic-agents' },
      {
        label: 'GitHub Integration',
        link: 'features/ci-features/github-integration',
      },

      // Setup & Configuration - grouped
      {
        label: 'Setup & Configuration',
        collapsed: true,
        items: [
          { label: 'Setup CI', link: 'guides/nx-cloud/setup-ci' },
          {
            label: 'Optimize Your TTG',
            link: 'guides/nx-cloud/optimize-your-ttg',
          },
          { label: 'Access Tokens', link: 'guides/nx-cloud/access-tokens' },
          {
            label: 'Personal Access Tokens',
            link: 'guides/nx-cloud/personal-access-tokens',
          },
          { label: 'Encryption', link: 'guides/nx-cloud/encryption' },
          {
            label: 'Enable AI Features',
            link: 'guides/nx-cloud/enable-ai-features',
          },
          { label: 'Record Commands', link: 'guides/nx-cloud/record-commands' },
          {
            label: 'CI Resource Usage',
            link: 'guides/nx-cloud/ci-resource-usage',
          },
          {
            label: 'CIPE Affected Project Graph',
            link: 'guides/nx-cloud/cipe-affected-project-graph',
          },
          { label: 'Manual DTE', link: 'guides/nx-cloud/manual-dte' },
          { label: 'Google Auth', link: 'guides/nx-cloud/google-auth' },
          {
            label: 'Source Control Integration',
            collapsed: true,
            autogenerate: {
              directory: 'guides/Nx Cloud/Source Control Integration',
              collapsed: true,
            },
          },
        ],
      },

      // Module Boundaries - moved from Build with Nx
      {
        label: 'Module Boundaries',
        collapsed: true,
        items: [
          {
            label: 'Overview',
            link: 'scale-with-nx/module-boundaries/overview',
          },
          {
            label: 'Tag Multiple Dimensions',
            link: 'scale-with-nx/module-boundaries/tag-multiple-dimensions',
          },
          {
            label: 'Ban Dependencies with Tags',
            link: 'scale-with-nx/module-boundaries/ban-dependencies-with-tags',
          },
          {
            label: 'Ban External Imports',
            link: 'scale-with-nx/module-boundaries/ban-external-imports',
          },
          {
            label: 'Tags Allow List',
            link: 'scale-with-nx/module-boundaries/tags-allow-list',
          },
        ],
      },

      // Conformance - moved from Reference
      {
        label: 'Conformance',
        collapsed: true,
        items: [
          { label: 'Overview', link: 'scale-with-nx/conformance/overview' },
          {
            label: 'Create Conformance Rule',
            link: 'scale-with-nx/conformance/create-conformance-rule',
          },
          {
            label: 'Test Conformance Rule',
            link: 'scale-with-nx/conformance/test-conformance-rule',
          },
          { label: 'Executors', link: 'scale-with-nx/conformance/executors' },
          { label: 'Generators', link: 'scale-with-nx/conformance/generators' },
        ],
      },

      // Owners - moved from Reference
      {
        label: 'Owners',
        collapsed: true,
        items: [
          { label: 'Overview', link: 'scale-with-nx/owners/overview' },
          { label: 'Generators', link: 'scale-with-nx/owners/generators' },
        ],
      },

      // Nx Console
      {
        label: 'Nx Console',
        collapsed: true,
        autogenerate: { directory: 'guides/Nx Console', collapsed: true },
      },

      // Enterprise
      {
        label: 'Enterprise',
        collapsed: true,
        autogenerate: { directory: 'enterprise', collapsed: true },
      },
    ],
  },

  // ============================================
  // 4. EXTEND NX
  // ============================================
  {
    label: 'Extend Nx',
    collapsed: true,
    autogenerate: { directory: 'extending-nx', collapsed: true },
  },

  // ============================================
  // 5. REFERENCE
  // ============================================
  {
    label: 'Reference',
    collapsed: true,
    items: [
      // Dynamically added via middleware:
      // - Nx Commands
      // - create-nx-workspace
      // - Plugin Registry
      // - Changelog

      // Main reference content
      { label: 'nx.json', link: 'reference/nx-json' },
      {
        label: 'Project Configuration',
        link: 'reference/project-configuration',
      },
      { label: 'Inputs', link: 'reference/inputs' },
      {
        label: 'Environment Variables',
        link: 'reference/environment-variables',
      },
      { label: 'Glossary', link: 'reference/glossary' },
      { label: '.nxignore', link: 'reference/nxignore' },
      { label: 'Releases', link: 'reference/releases' },
      { label: 'Nx Console Settings', link: 'reference/nx-console-settings' },
      { label: 'Nx Cloud CLI', link: 'reference/nx-cloud-cli' },
      {
        label: 'Node/TypeScript Compatibility',
        link: 'reference/nodejs-typescript-compatibility',
      },
      {
        label: 'Nx Cloud',
        collapsed: true,
        autogenerate: { directory: 'reference/Nx Cloud', collapsed: true },
      },
      {
        label: 'Remote Cache Plugins',
        collapsed: true,
        autogenerate: {
          directory: 'reference/Remote Cache Plugins',
          collapsed: true,
        },
      },
      {
        label: 'Benchmarks',
        collapsed: true,
        autogenerate: { directory: 'reference/Benchmarks', collapsed: true },
      },
      {
        label: 'Deprecated',
        collapsed: true,
        autogenerate: { directory: 'reference/Deprecated', collapsed: true },
      },
      // Tips & Tricks - remaining items after split
      {
        label: 'Tips & Tricks',
        collapsed: true,
        autogenerate: { directory: 'guides/Tips-n-Tricks', collapsed: true },
      },
      {
        label: 'Troubleshooting',
        collapsed: true,
        autogenerate: { directory: 'troubleshooting', collapsed: true },
      },
    ],
  },
];
