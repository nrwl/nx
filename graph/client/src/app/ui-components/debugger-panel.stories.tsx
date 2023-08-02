import type { Meta, StoryObj } from '@storybook/react';
import { DebuggerPanel } from './debugger-panel';

const meta: Meta<typeof DebuggerPanel> = {
  component: DebuggerPanel,
  title: 'Shell/DebuggerPanel',
  argTypes: {
    selectedProjectChange: { action: 'projectGraphChange' },
  },
};

export default meta;
type Story = StoryObj<typeof DebuggerPanel>;

export const Primary: Story = {
  args: {
    projects: [
      {
        url: 'some-graph.json',
        label: 'Some graph',
        id: 'some-graph',
      } as any,
      {
        url: 'another-graph.json',
        label: 'Another graph',
        id: 'another-graph',
      } as any,
    ],
    selectedProject: 'another-graph',
    lastPerfReport: {
      numEdges: 20,
      numNodes: 10,
      renderTime: 500,
    },
  },
};
