import { ComponentStory, ComponentMeta } from '@storybook/react';
import { NxProjectGraphViz } from './nx-project-graph-viz';

const Story: ComponentMeta<typeof NxProjectGraphViz> = {
  component: NxProjectGraphViz,
  title: 'NxProjectGraphViz',
};
export default Story;

const Template: ComponentStory<typeof NxProjectGraphViz> = (args) => (
  <NxProjectGraphViz {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  projects: [
    {
      type: 'app',
      name: 'app',
      data: {
        tags: ['scope:cart'],
        description: 'This is your top-level app',
        files: [
          {
            file: 'whatever.ts',
            deps: ['lib'],
          },
        ],
      },
    },
    {
      type: 'lib',
      name: 'lib',
      data: {
        tags: ['scope:cart'],
        description: 'This lib implements some type of feature for your app.',
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
  enableTooltips: true,
};
