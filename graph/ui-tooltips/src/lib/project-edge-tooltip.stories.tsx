import type { Meta, StoryObj } from '@storybook/react';
import {
  ProjectEdgeNodeTooltip,
  ProjectEdgeNodeTooltipProps,
} from './project-edge-tooltip';
import { Tooltip } from './tooltip';

const meta: Meta<typeof ProjectEdgeNodeTooltip> = {
  component: ProjectEdgeNodeTooltip,
  title: 'Tooltips/ProjectEdgeNodeTooltip',
};

export default meta;
type Story = StoryObj<typeof ProjectEdgeNodeTooltip>;

export const Primary: Story = {
  args: {
    type: 'static',
    target: 'lib1',
    source: 'lib2',
    fileDependencies: [{ fileName: 'some/file.ts' }],
  } as ProjectEdgeNodeTooltipProps,
  render: (args) => {
    return (
      <div className="flex w-full justify-center">
        <Tooltip
          open={true}
          openAction="manual"
          content={(<ProjectEdgeNodeTooltip {...args} />) as any}
        >
          <p>Internal Reference</p>
        </Tooltip>
      </div>
    );
  },
};
