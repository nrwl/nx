import type { Meta, StoryObj } from '@storybook/react';
import { OwnersList } from './owners-list';

const meta: Meta<typeof OwnersList> = {
  component: OwnersList,
  title: 'OwnersList',
};
export default meta;

type Story = StoryObj<typeof OwnersList>;

export const FewOwners: Story = {
  args: {
    owners: ['owner1', 'owner2', 'owner3'],
  },
};
export const ManyOwners: Story = {
  args: {
    owners: [
      'owner1',
      'owner2',
      'owner3',
      'owner4',
      'owner5',
      'owner6',
      'owner7',
      'owner8',
      'owner9',
      'owner10',
      'owner11',
      'owner12',
      'owner13',
      'owner14',
      'owner15',
      'owner16',
      'owner17',
      'owner18',
      'owner19',
      'owner20',
    ],
  },
};
