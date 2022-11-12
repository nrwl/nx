import { ComponentMeta, ComponentStory } from '@storybook/react';
import { Tag } from './tag';

const Story: ComponentMeta<typeof Tag> = {
  component: Tag,
  title: 'Shared/Tag',
};
export default Story;

const Template: ComponentStory<typeof Tag> = (args) => <Tag>{args.text}</Tag>;

export const Primary = Template.bind({});
Primary.args = {
  text: 'tag',
};
