import type { Meta, StoryObj } from '@storybook/react-webpack5';
import {
  SourcemapInfoToolTip,
  SourcemapInfoToolTipProps,
} from './sourcemap-info-tooltip';
import { Tooltip } from '@nx/graph/legacy/tooltips';

const meta: Meta<typeof SourcemapInfoToolTip> = {
  component: SourcemapInfoToolTip,
  title: 'Tooltips/SourcemapInfoToolTip',
};

export default meta;
type Story = StoryObj<typeof SourcemapInfoToolTip>;

export const Primary: Story = {
  render: (args) => (
    <div className="flex w-full justify-center">
      <Tooltip
        open={true}
        content={(<SourcemapInfoToolTip {...args} />) as any}
      >
        <p>Internal Reference</p>
      </Tooltip>
    </div>
  ),
  args: {
    propertyKey: 'targets.build.command',
    plugin: 'nx-core-build-project-json-nodes',
    file: 'tools/eslint-rules/project.json',
  } as SourcemapInfoToolTipProps,
};
