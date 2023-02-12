import { ComponentMeta, ComponentStory } from '@storybook/react';
import {
  ProjectEdgeNodeTooltip,
  ProjectEdgeNodeTooltipProps,
} from './project-edge-tooltip';
import { Tooltip } from './tooltip';

export default {
  component: ProjectEdgeNodeTooltip,
  title: 'Tooltips/ProjectEdgeNodeTooltip',
} as ComponentMeta<typeof ProjectEdgeNodeTooltip>;

const Template: ComponentStory<typeof ProjectEdgeNodeTooltip> = (args) => {
  return (
    <div className="flex w-full justify-center">
      <Tooltip
        open={true}
        openAction="manual"
        content={<ProjectEdgeNodeTooltip {...args} />}
      >
        <p>Internal Reference</p>
      </Tooltip>
    </div>
  );
};

export const Primary = Template.bind({});
Primary.args = {
  type: 'static',
  target: 'lib1',
  source: 'lib2',
  fileDependencies: [{ fileName: 'some/file.ts' }],
} as ProjectEdgeNodeTooltipProps;
