import { ComponentStory, ComponentMeta } from '@storybook/react';
import {
  ShowHideAllProjects,
  ShowHideAllProjectsProps,
} from './show-hide-projects';

export default {
  component: ShowHideAllProjects,
  title: 'Project Graph/ShowHideAllProjects',
  argTypes: {
    hideAllProjects: { action: 'hideAllProjects' },
    showAffectedProjects: { action: 'showAffectedProjects' },
    showAllProjects: { action: 'showAllProjects' },
  },
} as ComponentMeta<typeof ShowHideAllProjects>;

const Template: ComponentStory<typeof ShowHideAllProjects> = (args) => (
  <ShowHideAllProjects {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  hasAffectedProjects: false,
};

export const Affected = Template.bind({});
Affected.args = {
  hasAffectedProjects: true,
};
