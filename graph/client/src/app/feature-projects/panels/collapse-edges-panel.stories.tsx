import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CollapseEdgesPanel } from './collapse-edges-panel';

export default {
  component: CollapseEdgesPanel,
  title: 'Project Graph/CollapseEdgesPanel',
  argTypes: {
    collapseEdges: Boolean,
    collapseEdgesChanged: { action: 'collapseEdgesChanged' },
  },
} as ComponentMeta<typeof CollapseEdgesPanel>;

const Template: ComponentStory<typeof CollapseEdgesPanel> = (args) => (
  <CollapseEdgesPanel {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  collapseEdges: false,
};
