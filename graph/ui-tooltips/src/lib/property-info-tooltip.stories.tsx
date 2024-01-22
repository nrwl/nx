import type { Meta, StoryObj } from '@storybook/react';
import {
  PropertyInfoTooltipProps,
  PropertyInfoTooltip,
} from './property-info-tooltip';
import { Tooltip } from './tooltip';

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
