import type { Meta, StoryObj } from '@storybook/react';
import { MonochromaticTechnologyIconsMap } from './technology-icons-map-monochromatic';

const meta: Meta<typeof MonochromaticTechnologyIconsMap> = {
  component: () => (
    <>
      {Object.keys(MonochromaticTechnologyIconsMap).map((key) => {
        const Icon = MonochromaticTechnologyIconsMap[key].icon;
        return (
          <>
            <div>{key}</div>
            <div className="h-10 w-10">
              <Icon />
            </div>
          </>
        );
      })}
    </>
  ),
  title: 'MonochromaticTechnologyIconsMap',
};
export default meta;
type Story = StoryObj<typeof MonochromaticTechnologyIconsMap>;

export const Primary: Story = {
  args: {},
};
