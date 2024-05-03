/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
import { TargetConfigurationGroupList } from '../target-configuration-details-group-list/target-configuration-details-group-list';

export interface TargetConfigurationDetailsListProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  variant?: 'default' | 'compact';
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  className?: string;
}

export function TargetConfigurationDetailsList({
  project,
  variant,
  sourceMap,
  onRunTarget,
  onViewInTaskGraph,
  className,
}: TargetConfigurationDetailsListProps) {
  return (
    <TargetConfigurationGroupList
      project={project}
      sourceMap={sourceMap}
      variant={variant}
      onRunTarget={onRunTarget}
      onViewInTaskGraph={onViewInTaskGraph}
      className={className}
    />
  );
}
