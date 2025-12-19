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
      // --- CORE (Nx-specific features) - FIRST ---
      {
        label: 'Core',
        collapsed: true,
        items: [
          // Features flattened directly under Core
          { label: 'Run Tasks', link: 'features/run-tasks' },
          { label: 'Cache Task Results', link: 'features/cache-task-results' },
          { label: 'Explore the Graph', link: 'features/explore-graph' },
          { label: 'Generate Code', link: 'features/generate-code' },
          {
            label: 'Enforce Module Boundaries',
            link: 'features/enforce-module-boundaries',
          },
          { label: 'Manage Releases', link: 'features/manage-releases' },
          {
            label: 'Automate Updating Dependencies',
            link: 'features/automate-updating-dependencies',
          },
          {
            label: 'Maintain TypeScript Monorepos',
            link: 'features/maintain-typescript-monorepos',
          },
          { label: 'Enhance AI', link: 'features/enhance-ai' },
          {
            label: 'CI Basics',
            collapsed: true,
            items: [
              // Links to Scale section for now
              { label: 'CI Features Overview', link: 'features/ci-features' },
            ],
          },
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
                label: 'Enforce Module Boundaries',
                collapsed: true,
                autogenerate: {
                  directory: 'guides/Enforce Module Boundaries',
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
              { label: 'CI Deployment', link: 'guides/ci-deployment' },
            ],
          },
        ],
      },

      // --- TECHNOLOGIES (flattened from current structure) ---
      {
        label: 'TypeScript',
        collapsed: true,
        items: getPluginItems('js'),
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
      {
        label: 'Nx Cloud',
        collapsed: true,
        autogenerate: { directory: 'guides/Nx Cloud', collapsed: true },
      },
      {
        label: 'CI Features',
        collapsed: true,
        autogenerate: { directory: 'features/CI Features', collapsed: true },
      },
      {
        label: 'Nx Console',
        collapsed: true,
        autogenerate: { directory: 'guides/Nx Console', collapsed: true },
      },
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
      { label: 'Nx MCP', link: 'reference/nx-mcp' },
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
        label: 'Conformance',
        collapsed: true,
        autogenerate: { directory: 'reference/Conformance', collapsed: true },
      },
      {
        label: 'Owners',
        collapsed: true,
        autogenerate: { directory: 'reference/Owners', collapsed: true },
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
      // Moved from guides
      {
        label: 'Tips & Tricks',
        collapsed: true,
        autogenerate: { directory: 'guides/Tips-n-Tricks', collapsed: true },
      },
      // Moved from top-level
      {
        label: 'Troubleshooting',
        collapsed: true,
        autogenerate: { directory: 'troubleshooting', collapsed: true },
      },
    ],
  },
];
