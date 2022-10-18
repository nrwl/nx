import { ComponentStory, ComponentMeta } from '@storybook/react';
import { NxGraphViz } from './nx-graph-viz';

const Story: ComponentMeta<typeof NxGraphViz> = {
  component: NxGraphViz,
  title: 'NxGraphViz',
};
export default Story;

const Template: ComponentStory<typeof NxGraphViz> = (args) => (
  <NxGraphViz {...args} />
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
  groupByFolder: true,
  workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
  dependencies: {
    app: [{ target: 'lib', source: 'app', type: 'direct' }],
    lib: [
      { target: 'lib2', source: 'lib', type: 'implicit' },
      { target: 'lib3', source: 'lib', type: 'direct' },
    ],
    lib2: [],
    lib3: [],
  },
  affectedProjectIds: [],
  theme: 'light',
  height: '450px',
};
