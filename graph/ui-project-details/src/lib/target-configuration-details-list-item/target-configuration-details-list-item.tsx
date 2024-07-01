/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
import TargetConfigurationDetails from '../target-configuration-details/target-configuration-details';

export interface TargetConfigurationDetailsListItemProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  connectedToCloud?: boolean;
  variant?: 'default' | 'compact';
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  onNxConnect?: () => void;
  targetName: string;
  collapsable: boolean;
}

export function TargetConfigurationDetailsListItem({
  project,
  variant,
  sourceMap,
  connectedToCloud,
  onRunTarget,
  onViewInTaskGraph,
  onNxConnect,
  targetName,
  collapsable,
}: TargetConfigurationDetailsListItemProps) {
  const target = project.data.targets?.[targetName];
  if (!target) {
    return null;
  }
  return (
    <li className="mb-4 last:mb-0" key={`target-${targetName}`}>
      <TargetConfigurationDetails
        variant={variant}
        projectName={project.name}
        targetName={targetName}
        targetConfiguration={target}
        sourceMap={sourceMap}
        connectedToCloud={connectedToCloud}
        onRunTarget={onRunTarget}
        onViewInTaskGraph={onViewInTaskGraph}
        onNxConnect={onNxConnect}
        collapsable={collapsable}
      />
    </li>
  );
}
