import { ComponentMeta, ComponentStory } from '@storybook/react';
import { TracingPanel } from './tracing-panel';

export default {
  component: TracingPanel,
  title: 'Project Graph/TracingPanel',
  argTypes: {
    resetEnd: { action: 'resetEnd' },
    resetStart: { action: 'resetStart' },
    setAlgorithm: { action: 'setAlgorithm' },
  },
} as ComponentMeta<typeof TracingPanel>;

const Template: ComponentStory<typeof TracingPanel> = (args) => (
  <TracingPanel {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  end: 'shared-ui',
  start: 'store',
  algorithm: 'shortest',
};
