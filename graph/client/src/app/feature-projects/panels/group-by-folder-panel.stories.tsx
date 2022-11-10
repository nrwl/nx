import { ComponentMeta, ComponentStory } from '@storybook/react';
import { GroupByFolderPanel } from './group-by-folder-panel';

export default {
  component: GroupByFolderPanel,
  title: 'Project Graph/GroupByFolderPanel',
  argTypes: { groupByFolderChanged: { action: 'groupByFolderChanged' } },
} as ComponentMeta<typeof GroupByFolderPanel>;

const Template: ComponentStory<typeof GroupByFolderPanel> = (args) => (
  <GroupByFolderPanel {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  groupByFolder: false,
};
