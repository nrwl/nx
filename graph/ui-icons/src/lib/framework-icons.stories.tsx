import type { Meta, StoryObj } from '@storybook/react';
import { Framework, frameworkIcons } from './framework-icons';

const meta: Meta<typeof frameworkIcons> = {
  component: () => (
    <>
      {Object.keys(frameworkIcons).map((key) => (
        <>
          <div>{key}</div>
          <div className="h-10 w-10">
            {frameworkIcons[key as Framework].image}
          </div>
        </>
      ))}
    </>
  ),
  title: 'frameworkIcons',
};
export default meta;
type Story = StoryObj<typeof frameworkIcons>;

export const Primary: Story = {
  args: {},
};
