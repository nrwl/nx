export const sidebar = [
  {
    label: 'Getting Started',
    items: [
      { label: 'Introduction', link: 'getting-started/intro' },
      { label: 'Installation', link: 'getting-started/installation' },
      {
        label: 'Start a new project',
        link: 'getting-started/start-new-project',
      },
      {
        label: 'Add to existing project',
        link: 'getting-started/start-with-existing-project',
      },
      { label: 'Editor Integration', link: 'getting-started/editor-setup' },
      { label: 'AI Integration', link: 'getting-started/ai-setup' },
      {
        label: 'Tutorials',
        collapsed: true,
        items: [
          {
            label: 'TypeScript Monorepo',
            link: 'getting-started/tutorials/typescript-packages-tutorial',
          },
          {
            label: 'React Monorepo',
            link: 'getting-started/tutorials/react-monorepo-tutorial',
          },
          {
            label: 'Angular Monorepo',
            link: 'getting-started/tutorials/angular-monorepo-tutorial',
          },
          {
            label: 'Gradle Monorepo',
            link: 'getting-started/tutorials/gradle-tutorial',
          },
        ],
      },
    ],
  },
  {
    label: 'Features',
    items: [
      { label: 'Run Tasks', link: 'features/run-tasks' },
      { label: 'Cache Task Results', link: 'features/cache-task-results' },
      { label: 'Enhance Your LLM', link: 'features/enhance-AI' },
      { label: 'Explore Your Workspace', link: 'features/explore-graph' },
      { label: 'Generate Code', link: 'features/generate-code' },
      {
        label: 'Maintain TypeScript Monorepos',
        link: 'features/maintain-ts-monorepos',
      },
      {
        label: 'Automate Updating Dependencies',
        link: 'features/automate-updating-dependencies',
      },
      {
        label: 'Enforce Module Boundaries',
        link: 'features/enforce-module-boundaries',
      },
      { label: 'Manage Releases', link: 'features/manage-releases' },
      {
        label: 'CI Features',
        collapsed: true,
        items: [
          {
            label: 'AI-Powered Self-Healing CI',
            link: 'ci/features/self-healing-ci',
          },
          {
            label: 'Use Remote Caching (Nx Replay)',
            link: 'ci/features/remote-cache',
          },
          {
            label: 'Distribute Task Execution (Nx Agents)',
            link: 'ci/features/distribute-task-execution',
          },
          {
            label: 'Run Only Tasks Affected by a PR',
            link: 'ci/features/affected',
          },
          {
            label: 'Dynamically Allocate Agents',
            link: 'ci/features/dynamic-agents',
          },
          {
            label: 'Automatically Split E2E Tasks',
            link: 'ci/features/split-e2e-tasks',
          },
          {
            label: 'Identify and Re-run Flaky Tasks',
            link: 'ci/features/flaky-tasks',
          },
        ],
      },
    ],
  },
  {
    label: 'Core Guides',
    collapsed: true,
    items: [
      {
        label: 'Installation',
        collapsed: true,
        autogenerate: { directory: 'guides/installation' },
      },
      {
        label: 'Tasks & Caching',
        collapsed: true,
        autogenerate: { directory: 'guides/tasks-caching' },
      },
      {
        label: 'Adopting Nx',
        collapsed: true,
        autogenerate: { directory: 'guides/adopting-nx' },
      },
      {
        label: 'Nx Release',
        collapsed: true,
        autogenerate: { directory: 'guides/nx-release' },
      },
      {
        label: 'Nx Console',
        collapsed: true,
        autogenerate: { directory: 'guides/nx-console' },
      },
      {
        label: 'Enforce Module Boundaries',
        collapsed: true,
        autogenerate: { directory: 'guides/enforce-module-boundaries' },
      },
      {
        label: 'Tips and tricks',
        collapsed: true,
        autogenerate: { directory: 'guides/tips-and-tricks' },
      },
    ],
  },
  {
    label: 'Core Concepts',
    collapsed: true,
    autogenerate: { directory: 'concepts' },
  },
  {
    label: 'Technologies',
    items: [
      {
        label: 'TypeScript',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/typescript/introduction',
          },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: { directory: 'technologies/typescript/guides' },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/typescript/api' },
          },
        ],
      },
      {
        label: 'Angular',
        collapsed: true,
        items: [
          { label: 'Introduction', link: 'technologies/angular/introduction' },
          {
            label: 'Migration',
            collapsed: true,
            autogenerate: { directory: 'technologies/angular/migration' },
          },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: { directory: 'technologies/angular/guides' },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/angular/api' },
          },
          {
            label: 'Angular Rspack',
            collapsed: true,
            autogenerate: { directory: 'technologies/angular/angular-rspack' },
          },
          {
            label: 'Angular Rsbuild',
            collapsed: true,
            autogenerate: { directory: 'technologies/angular/angular-rsbuild' },
          },
        ],
      },
      {
        label: 'React',
        collapsed: true,
        items: [
          { label: 'Introduction', link: 'technologies/react/introduction' },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: { directory: 'technologies/react/guides' },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/react/api' },
          },
          {
            label: 'Next',
            collapsed: true,
            autogenerate: { directory: 'technologies/react/next' },
          },
          {
            label: 'Remix',
            collapsed: true,
            autogenerate: { directory: 'technologies/react/remix' },
          },
          {
            label: 'React Native',
            collapsed: true,
            autogenerate: { directory: 'technologies/react/react-native' },
          },
          {
            label: 'Expo',
            collapsed: true,
            autogenerate: { directory: 'technologies/react/expo' },
          },
        ],
      },
      {
        label: 'Vue',
        collapsed: true,
        items: [
          { label: 'Introduction', link: 'technologies/vue/introduction' },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: { directory: 'technologies/vue/guides' },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/vue/api' },
          },
        ],
      },
      {
        label: 'Node.js',
        collapsed: true,
        items: [
          { label: 'Introduction', link: 'technologies/node/introduction' },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: { directory: 'technologies/node/guides' },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/node/api' },
          },
          {
            label: 'Express',
            collapsed: true,
            autogenerate: { directory: 'technologies/node/express' },
          },
          {
            label: 'Nest',
            collapsed: true,
            autogenerate: { directory: 'technologies/node/nest' },
          },
        ],
      },
      {
        label: 'Java',
        collapsed: true,
        items: [
          { label: 'Introduction', link: 'technologies/java/introduction' },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: { directory: 'technologies/java/guides' },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/java/api' },
          },
        ],
      },
      {
        label: 'Module Federation',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/module-federation/introduction',
          },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: {
              directory: 'technologies/module-federation/guides',
            },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/module-federation/api' },
          },
        ],
      },
      {
        label: 'ESLint',
        collapsed: true,
        items: [
          { label: 'Introduction', link: 'technologies/eslint/introduction' },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: { directory: 'technologies/eslint/guides' },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/eslint/api' },
          },
        ],
      },
      {
        label: 'Build Tools',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/build-tools/introduction',
          },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: { directory: 'technologies/build-tools/guides' },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/build-tools/api' },
          },
        ],
      },
      {
        label: 'Test Tools',
        collapsed: true,
        items: [
          {
            label: 'Introduction',
            link: 'technologies/test-tools/introduction',
          },
          {
            label: 'Guides',
            collapsed: true,
            autogenerate: { directory: 'technologies/test-tools/guides' },
          },
          {
            label: 'API',
            collapsed: true,
            autogenerate: { directory: 'technologies/test-tools/api' },
          },
        ],
      },
    ],
  },
  {
    label: 'Enterprise',
    collapsed: true,
    autogenerate: { directory: 'enterprise' },
  },
  {
    label: 'Showcase',
    items: [
      {
        label: 'Nx with your favorite tech',
        collapsed: true,
        autogenerate: { directory: 'showcase/nx-with-favorite-tech' },
      },
      {
        label: 'Benchmarks',
        collapsed: true,
        autogenerate: { directory: 'showcase/benchmarks' },
      },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Commands', link: 'reference/nx-commands' },
      { label: 'Nx Configuration', link: 'reference/nx-json' },
      {
        label: 'Project Configuration',
        link: 'reference/project-configuration',
      },
      { label: 'Inputs and Named Inputs', link: 'reference/inputs' },
      { label: '.nxignore', link: 'reference/nxignore' },
      {
        label: 'Environment Variables',
        link: 'reference/environment-variables',
      },
      { label: 'Glossary', link: 'reference/glossary' },
      { label: 'Releases', link: 'reference/releases' },
      {
        label: 'API',
        collapsed: true,
        items: [
          // have to use link bc slug is mapped to the /docs/ folder but we need the astro component in the pages/ dir
          { label: 'Nx CLI', link: 'api/nx-cli' },
          { label: 'Nx Cloud CLI', slug: 'api/nx-cloud-cli' },
          { label: 'create-nx-workspace', link: 'api/create-nx-workspace' },
          {
            label: 'devkit',
            collapsed: true,
            items: [
              { label: 'Overview', link: 'api/plugins/devkit/' },
              {
                label: 'Ng CLI Adapter',
                link: 'api/plugins/devkit/ngcli_adapter',
              },
            ],
          },
          // plugins are autogenerated from the Nx repository via the sidebar plugin
        ],
      },
    ],
  },
  {
    label: 'Troubleshooting',
    items: [
      {
        label: 'Resolve Circular Dependencies',
        link: 'troubleshooting/resolve-circular-dependencies',
      },
      {
        label: 'Troubleshoot Nx Install Issues',
        link: 'troubleshooting/troubleshoot-nx-install-issues',
      },
      {
        label: 'Troubleshoot Cache Misses',
        link: 'troubleshooting/troubleshoot-cache-misses',
      },
      {
        label: 'Unknown Local Cache Error',
        link: 'troubleshooting/unknown-local-cache',
      },
      {
        label: 'Profiling Build Performance',
        link: 'troubleshooting/performance-profiling',
      },
      {
        label: 'Troubleshoot Nx Console Issues',
        link: 'recipes/nx-console/console-troubleshooting',
      },
      {
        label: 'Troubleshoot Convert to Inferred Migration',
        link: 'troubleshooting/convert-to-inferred',
      },
    ],
  },
];
