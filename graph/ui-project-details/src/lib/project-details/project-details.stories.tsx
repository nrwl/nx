import type { Meta } from '@storybook/react';
import { ProjectDetails } from './project-details';

const meta: Meta<typeof ProjectDetails> = {
  component: ProjectDetails,
  title: 'ProjectDetails',
};
export default meta;

export const Primary = {
  args: {
    project: {
      name: 'demo',
      data: {
        root: ' packages/demo',
        projectType: 'application',
        targets: {
          dev: {
            executor: 'nx:run-commands',
            options: {
              command: 'vite dev',
            },
          },
          build: {
            executor: 'nx:run-commands',
            inputs: ['production', '^production'],
            outputs: ['{projectRoot}/dist'],
            options: {
              command: 'vite build',
            },
          },
        },
      },
    },
    sourceMap: {
      targets: ['packages/demo/vite.config.ts', '@nx/vite'],
      'targets.dev': ['packages/demo/vite.config.ts', '@nx/vite'],
      'targets.build': ['packages/demo/vite.config.ts', '@nx/vite'],
    },
  },
};
