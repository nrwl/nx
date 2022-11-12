import type { ComponentStory, ComponentMeta } from '@storybook/react';
import { NxTaskGraphViz } from './nx-task-graph-viz';

const Story: ComponentMeta<typeof NxTaskGraphViz> = {
  component: NxTaskGraphViz,
  title: 'NxTaskGraphViz',
};
export default Story;

const Template: ComponentStory<typeof NxTaskGraphViz> = (args) => (
  <NxTaskGraphViz {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  projects: [
    {
      type: 'app',
      name: 'app',
      data: {
        tags: ['scope:cart'],
      },
    },
    {
      type: 'lib',
      name: 'lib',
      data: {
        tags: ['scope:cart'],
      },
    },
    {
      type: 'lib',
      name: 'lib2',
      data: {
        root: 'libs/nested-scope/lib2',
        tags: ['scope:cart'],
      },
    },
    {
      type: 'lib',
      name: 'lib3',
      data: {
        root: 'libs/nested-scope/lib3',
        tags: ['scope:cart'],
      },
    },
  ],
  taskGraphs: {
    app: {
      build: {
        production: {
          roots: ['app:build:production'],
          tasks: {
            'app:build:production': {
              id: 'app:build:production',
              target: {
                project: 'app',
                target: 'build',
              },
            },
            'lib1:build': {
              id: 'lib1:build',
              target: {
                project: 'lib1',
                target: 'build',
              },
            },
            'lib2:build': {
              id: 'lib2:build',
              target: {
                project: 'lib2',
                target: 'build',
              },
            },
            'lib3:build': {
              id: 'lib3:build',
              target: {
                project: 'lib3',
                target: 'build',
              },
            },
          },
          dependencies: {
            'app:build:production': ['lib1:build', 'lib2:build', 'lib3:build'],
            'lib1:build': [],
            'lib2:build': [],
            'lib3:build': [],
          },
        },
      },
    },
  },
  taskId: 'app:build:production',
  height: '450px',
};
