import { ComponentMeta, ComponentStory } from '@storybook/react';
import { EdgeNodeTooltip, EdgeNodeTooltipProps } from './edge-tooltip';
import Tippy from '@tippyjs/react';

export default {
  component: EdgeNodeTooltip,
  title: 'Tooltips/EdgeNodeTooltip',
} as ComponentMeta<typeof EdgeNodeTooltip>;

const Template: ComponentStory<typeof EdgeNodeTooltip> = (args) => (
  <Tippy
    content={<EdgeNodeTooltip {...args} />}
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
} as EdgeNodeTooltipProps;
