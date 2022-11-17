import { ComponentMeta, ComponentStory } from '@storybook/react';
import {
  ProjectEdgeNodeTooltip,
  ProjectEdgeNodeTooltipProps,
} from './project-edge-tooltip';
import Tippy from '@tippyjs/react';

export default {
  component: ProjectEdgeNodeTooltip,
  title: 'Tooltips/ProjectEdgeNodeTooltip',
} as ComponentMeta<typeof ProjectEdgeNodeTooltip>;

const Template: ComponentStory<typeof ProjectEdgeNodeTooltip> = (args) => (
  <Tippy
    content={<ProjectEdgeNodeTooltip {...args} />}
    visible={true}
    theme="nx"
    interactive={true}
    maxWidth="none"
  >
    <p></p>
  </Tippy>
);

export const Primary = Template.bind({});
Primary.args = {
  type: 'static',
  target: 'lib1',
  source: 'lib2',
  fileDependencies: [{ fileName: 'some/file.ts' }],
} as ProjectEdgeNodeTooltipProps;
