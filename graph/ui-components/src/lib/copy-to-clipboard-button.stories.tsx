import type { Meta, StoryObj } from '@storybook/react';
import {
  CopyToClipboardButton,
  CopyToClipboardButtonProps,
} from './copy-to-clipboard-button';

const meta: Meta<typeof CopyToClipboardButton> = {
  component: CopyToClipboardButton,
  title: 'CopyToClipboardButton',
};
export default meta;

type Story = StoryObj<typeof CopyToClipboardButton>;

export const Simple: Story = {
  args: {
    text: 'Hello, world!',
    tooltipAlignment: 'left',
  } as CopyToClipboardButtonProps,
};
