import type { Meta, StoryObj } from '@storybook/react';
import {
  TargetConfigurationDetailsHeader,
  TargetConfigurationDetailsHeaderProps,
} from './target-configuration-details-header';

const meta: Meta<typeof TargetConfigurationDetailsHeader> = {
  component: TargetConfigurationDetailsHeader,
  title: 'TargetConfigurationDetailsHeader',
};
export default meta;

type Story = StoryObj<typeof TargetConfigurationDetailsHeader>;

export const Compact: Story = {
  args: {
    isCollasped: true,
    toggleCollapse: () => {},
    collapsable: false,
    isCompact: true,
    targetConfiguration: {},
    projectName: 'jest',
    targetName: 'test',
    sourceMap: {},
    onRunTarget: () => {},
    onViewInTaskGraph: () => {},
  } as TargetConfigurationDetailsHeaderProps,
};

export const NotCompact: Story = {
  args: {
    isCollasped: true,
    toggleCollapse: () => {},
    collapsable: false,
    isCompact: false,
    targetConfiguration: {},
    projectName: 'jest',
    targetName: 'test',
    sourceMap: {},
    onRunTarget: () => {},
    onViewInTaskGraph: () => {},
  } as TargetConfigurationDetailsHeaderProps,
};

export const Expanded: Story = {
  args: {
    isCollasped: false,
    toggleCollapse: () => {},
    collapsable: true,
    isCompact: false,
    targetConfiguration: {},
    projectName: 'jest',
    targetName: 'test',
    sourceMap: {},
    onRunTarget: () => {},
    onViewInTaskGraph: () => {},
  } as TargetConfigurationDetailsHeaderProps,
};

export const Collapsed: Story = {
  args: {
    isCollasped: true,
    toggleCollapse: () => {},
    collapsable: true,
    isCompact: false,
    targetConfiguration: {},
    projectName: 'jest',
    targetName: 'test',
    sourceMap: {},
    onRunTarget: () => {},
    onViewInTaskGraph: () => {},
  } as TargetConfigurationDetailsHeaderProps,
};
