import { ComponentMeta, ComponentStory } from '@storybook/react';
import ThemePanel from './theme-panel';

export default {
  component: ThemePanel,
  title: 'Project Graph/ThemePanel',
} as ComponentMeta<typeof ThemePanel>;

const Template: ComponentStory<typeof ThemePanel> = () => <ThemePanel />;

export const Primary = Template.bind({});
Primary.args = {};
