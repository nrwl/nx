import type { Meta, StoryObj } from '@storybook/react';
import { NxTaskGraphViz } from './nx-task-graph-viz';

const meta: Meta<typeof NxTaskGraphViz> = {
  component: NxTaskGraphViz,
  title: 'NxTaskGraphViz',
};

export default meta;
type Story = StoryObj<typeof NxTaskGraphViz>;

export const Primary: Story = {
  args: {
    projects: [
      {
        type: 'app',
        name: 'app',
        data: {
          tags: ['scope:cart'],
          targets: {
            build: {
              executor: '@nrwl/js:tsc',
            },
          },
          description: 'The app uses this task to build itself.',
        },
      } as any,
      {
        type: 'lib',
        name: 'lib1',
        data: {
          tags: ['scope:cart'],
          targets: {
            build: {
              executor: '@nrwl/js:tsc',
            },
          },
          description: 'The lib uses this task to build itself.',
        },
      },
      {
        type: 'lib',
        name: 'lib2',
        data: {
          root: 'libs/nested-scope/lib2',
          tags: ['scope:cart'],
          targets: {
            build: {
              executor: '@nrwl/js:tsc',
            },
          },
        },
      },
      {
        type: 'lib',
        name: 'lib3',
        data: {
          root: 'libs/nested-scope/lib3',
          tags: ['scope:cart'],
          targets: {
            build: {
              executor: '@nrwl/js:tsc',
            },
          },
        },
      },
    ],
    taskGraphs: {
      'app:build': {
        tasks: {
          'app:build': {
            id: 'app:build',
            target: {
              project: 'app',
              target: 'build',
            },
          } as any,
          'lib1:build': {
            id: 'lib1:build',
            target: {
              project: 'lib1',
              target: 'build',
            },
          } as any,
          'lib2:build': {
            id: 'lib2:build',
            target: {
              project: 'lib2',
              target: 'build',
            },
          } as any,
          'lib3:build': {
            id: 'lib3:build',
            target: {
              project: 'lib3',
              target: 'build',
            },
          } as any,
        },
        dependencies: {
          'app:build': ['lib1:build', 'lib2:build', 'lib3:build'],
          'lib1:build': [],
          'lib2:build': [],
          'lib3:build': [],
        },
      } as any,
    },
    taskId: 'app:build',
    height: '450px',
    enableTooltips: true,
  },
};
