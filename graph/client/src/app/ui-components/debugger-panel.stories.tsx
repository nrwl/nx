import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DebuggerPanel } from './debugger-panel';

export default {
  component: DebuggerPanel,
  title: 'Shell/DebuggerPanel',
  argTypes: {
    selectedProjectChange: { action: 'projectGraphChange' },
  },
} as ComponentMeta<typeof DebuggerPanel>;

const Template: ComponentStory<typeof DebuggerPanel> = (args) => (
  <DebuggerPanel {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  projectGraphs: [
    {
      url: 'some-graph.json',
      label: 'Some graph',
      id: 'some-graph',
    },
    {
      url: 'another-graph.json',
      label: 'Another graph',
      id: 'another-graph',
    },
  ],
  selectedProjectGraph: 'another-graph',
  lastPerfReport: {
    numEdges: 20,
    numNodes: 10,
    renderTime: 500,
  },
};
