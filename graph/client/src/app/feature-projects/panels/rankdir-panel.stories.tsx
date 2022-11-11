import { ComponentMeta, ComponentStory } from '@storybook/react';
import RankDirPanel from './rankdir-panel';

export default {
  component: RankDirPanel,
  title: 'Project Graph/RankDirPanel',
} as ComponentMeta<typeof RankDirPanel>;

const Template: ComponentStory<typeof RankDirPanel> = () => <RankDirPanel />;

export const Primary = Template.bind({});
Primary.args = {};
