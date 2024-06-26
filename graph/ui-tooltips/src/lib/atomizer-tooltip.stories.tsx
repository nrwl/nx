import type { Meta, StoryObj } from '@storybook/react';
import { AtomizerTooltip, AtomizerTooltipProps } from './atomizer-tooltip';
import { Tooltip } from './tooltip';

const meta: Meta<typeof AtomizerTooltip> = {
  component: AtomizerTooltip,
  title: 'Tooltips/AtomizerTooltip',
};

export default meta;
type Story = StoryObj<typeof AtomizerTooltip>;

export const Cloud: Story = {
  args: {
    connectedToCloud: true,
    nonAtomizedTarget: 'e2e',
  } as AtomizerTooltipProps,
  render: (args) => {
    return (
      <div className="flex w-full justify-center">
        <Tooltip
          open={true}
          openAction="manual"
          content={(<AtomizerTooltip {...args} />) as any}
        >
          <p>Internal Reference</p>
        </Tooltip>
      </div>
    );
  },
};

export const NoCloud: Story = {
  args: {
    connectedToCloud: false,
    nonAtomizedTarget: 'e2e',
  } as AtomizerTooltipProps,
  render: (args) => {
    return (
      <div className="flex w-full justify-center">
        <Tooltip
          open={true}
          openAction="manual"
          content={(<AtomizerTooltip {...args} />) as any}
        >
          <p>Internal Reference</p>
        </Tooltip>
      </div>
    );
  },
};

export const NoCloudConsole: Story = {
  args: {
    connectedToCloud: false,
    nonAtomizedTarget: 'e2e',
    nxConnectCallback: () => console.log('nxConnectCallback'),
  } as AtomizerTooltipProps,
  render: (args) => {
    return (
      <div className="flex w-full justify-center">
        <Tooltip
          open={true}
          openAction="manual"
          content={(<AtomizerTooltip {...args} />) as any}
        >
          <p>Internal Reference</p>
        </Tooltip>
      </div>
    );
  },
};
