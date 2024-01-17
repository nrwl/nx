import type { Meta, StoryObj } from '@storybook/react';
import { filterSourceMap, JsonCodeBlock } from './json-code-block';

const meta: Meta<typeof JsonCodeBlock> = {
  component: JsonCodeBlock,
  title: 'JsonCodeBlock',
};
export default meta;

type Story = StoryObj<typeof JsonCodeBlock>;

export const RemixBuild: Story = {
  args: {
    data: {
      commands: [{ command: 'remix build' }],
      cwd: 'apps/demo',
    },
    sourceMap: filterSourceMap('targets.build.options', {
      root: ['apps/demo/project.json', 'nx-core-build-project-json-nodes'],
      name: ['apps/demo/project.json', 'nx-core-build-project-json-nodes'],
      targets: ['apps/demo/project.json', 'nx-core-build-project-json-nodes'],
      'targets.build': ['remix.config.js', '@nx/remix/plugin'],
      'targets.build.options.commands': ['remix.config.js', '@nx/remix/plugin'],
      'targets.build.options.cwd': ['remix.config.js', '@nx/remix/plugin'],
    }),
  },
};

export const CustomRender: Story = {
  args: {
    data: {
      command: 'remix build',
    },
    sourceMap: filterSourceMap('targets.build.options', {
      root: ['apps/demo/project.json', 'nx-core-build-project-json-nodes'],
      name: ['apps/demo/project.json', 'nx-core-build-project-json-nodes'],
      'targets.build.options.command': ['remix.config.js', '@nx/remix/plugin'],
    }),
    renderSource: (sourceInfo: Array<string>) => {
      return (
        <span className="text-slate-500 dark:text-slate-100">
          file: {sourceInfo[0]}; plugin: {sourceInfo[1]}
        </span>
      );
    },
  },
};
