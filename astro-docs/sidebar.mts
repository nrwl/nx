import type { StarlightUserConfig } from '@astrojs/starlight/types';
import { getPluginItems } from './src/plugins/utils/plugin-mappings';

export const sidebar: StarlightUserConfig['sidebar'] = [
  {
    label: 'Getting Started',
    collapsed: false,
    autogenerate: { directory: 'getting-started', collapsed: true },
  },
  {
    label: 'Features',
    collapsed: false,
    autogenerate: { directory: 'features', collapsed: true },
  },
  {
    label: 'Guides',
    collapsed: true,
    autogenerate: { directory: 'guides', collapsed: true },
  },
  {
    label: 'Concepts',
    collapsed: true,
    autogenerate: { directory: 'concepts', collapsed: true },
  },
  {
    label: 'Technologies',
    collapsed: false,
    // manually type the tech routes due to complexity of order and structure
    items: [
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
          // TODO: angular rspack and rsbuild are special cases
          //
          //   label: 'Angular Rspack',
          //   link: '/technologies/angular/angular-rspack/',
          //   items: getPluginItems('angular-rspack', 'angular'),
          // },
          // {
          //   label: 'Angular Rsbuild',
          //   link: '/technologies/angular/angular-rsbuild/',
          //   items: getPluginItems('angular-rsbuild', 'angular'),
          // },
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
        // when we have maven this will change to not have gradle as the top docs for Java
        items: getPluginItems('gradle', 'java'),
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
  {
    label: 'Enterprise',
    collapsed: true,
    autogenerate: { directory: 'enterprise', collapsed: true },
  },
  {
    label: 'Reference',
    collapsed: false,
    autogenerate: { directory: 'references', collapsed: true },
  },
  {
    label: 'Troubleshooting',
    collapsed: false,
    autogenerate: { directory: 'troubleshooting', collapsed: true },
  },
];
