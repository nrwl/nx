/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';

import { TargetConfigurationDetailsListItem } from '../target-configuration-details-list-item/target-configuration-details-list-item';
import { TargetConfigurationGroupContainer } from '../target-configuration-details-group-container/target-configuration-details-group-container';
import { groupTargets } from '../utils/group-targets';

export interface TargetConfigurationGroupListProps {
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

export function TargetConfigurationGroupList({
  project,
  variant,
  sourceMap,
  onRunTarget,
  onViewInTaskGraph,
  className = '',
}: TargetConfigurationGroupListProps) {
  const targetsGroup = groupTargets(project);

  return (
    <>
      {Object.entries(targetsGroup.groups).map(([targetGroupName, targets]) => {
        if (targets.length === 0) {
          return null;
        }
        return (
          <TargetConfigurationGroupContainer
            targetGroupName={targetGroupName}
            targetsNumber={targets.length}
            key={targetGroupName}
          >
            <ul className={className}>
              {targets.map((targetName) => (
                <TargetConfigurationDetailsListItem
                  project={project}
                  sourceMap={sourceMap}
                  variant={variant}
                  onRunTarget={onRunTarget}
                  onViewInTaskGraph={onViewInTaskGraph}
                  targetName={targetName}
                  collapsable={true}
                  key={targetName}
                />
              ))}
            </ul>
          </TargetConfigurationGroupContainer>
        );
      })}
      <ul className={`mt-8 p-2 ${className}`}>
        {targetsGroup.targets.map((targetName) => {
          return (
            <TargetConfigurationDetailsListItem
              project={project}
              sourceMap={sourceMap}
              variant={variant}
              onRunTarget={onRunTarget}
              onViewInTaskGraph={onViewInTaskGraph}
              targetName={targetName}
              collapsable={true}
              key={targetName}
            />
          );
        })}
      </ul>
    </>
  );
}
