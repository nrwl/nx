import type { Meta, StoryObj } from '@storybook/react-webpack5';
import {
  PropertyInfoTooltip,
  PropertyInfoTooltipProps,
} from './property-info-tooltip';
import { Tooltip } from '@nx/graph/legacy/tooltips';

const meta: Meta<typeof PropertyInfoTooltip> = {
  component: PropertyInfoTooltip,
  title: 'Tooltips/PropertyInfoToolTip',
};

export default meta;
type Story = StoryObj<typeof PropertyInfoTooltip>;

export const Primary: Story = {
  render: (args) => (
    <div className="flex w-full justify-center">
      <Tooltip open={true} content={(<PropertyInfoTooltip {...args} />) as any}>
        <p>Internal Reference</p>
      </Tooltip>
    </div>
  ),
  args: {
    type: 'inputs',
  } as PropertyInfoTooltipProps,
};
