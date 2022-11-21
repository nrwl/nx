import { ComponentMeta, ComponentStory } from '@storybook/react';
import { ShowHideAll } from './show-hide-all';

export default {
  component: ShowHideAll,
  title: 'Project Graph/ShowHideAllProjects',
  argTypes: {
    hideAll: { action: 'hideAllProjects' },
    showAffected: { action: 'showAffectedProjects' },
    showAll: { action: 'showAllProjects' },
  },
} as ComponentMeta<typeof ShowHideAll>;

const Template: ComponentStory<typeof ShowHideAll> = (args) => (
  <ShowHideAll {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  hasAffectedProjects: false,
};

export const Affected = Template.bind({});
Affected.args = {
  hasAffectedProjects: true,
};
