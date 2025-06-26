/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '../types/graph-types';

import { TargetConfigurationDetailsListItem } from '../target-configuration-details-list-item/target-configuration-details-list-item';
import { TargetConfigurationGroupContainer } from '../target-configuration-details-group-container/target-configuration-details-group-container';
import { groupTargets } from '../utils/group-targets';
import { useMemo } from 'react';

export interface TargetConfigurationGroupListProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  variant?: 'default' | 'compact';
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  onNxConnect?: () => void;
  connectedToCloud?: boolean;
  disabledTaskSyncGenerators?: string[];
  className?: string;
}

export function TargetConfigurationGroupList({
  project,
  variant,
  sourceMap,
  onRunTarget,
  onViewInTaskGraph,
  onNxConnect,
  className = '',
  connectedToCloud,
  disabledTaskSyncGenerators,
}: TargetConfigurationGroupListProps) {
  const targetsGroup = useMemo(() => groupTargets(project), [project]);
  const hasGroups = useMemo(() => {
    for (const group of Object.entries(targetsGroup.groups)) {
      if (group[1]?.length > 0) return true;
    }
    return false;
  }, [targetsGroup]);

  if (hasGroups) {
    return (
      <>
        {Object.entries(targetsGroup.groups)
          .sort(([targetGroupName1], [targetGroupName2]) =>
            targetGroupName1.localeCompare(targetGroupName2)
          )
          .map(([targetGroupName, targets]) => {
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
                      connectedToCloud={connectedToCloud}
                      disabledTaskSyncGenerators={disabledTaskSyncGenerators}
                      variant={variant}
                      onRunTarget={onRunTarget}
                      onViewInTaskGraph={onViewInTaskGraph}
                      onNxConnect={onNxConnect}
                      targetName={targetName}
                      collapsable={true}
                      key={targetName}
                    />
                  ))}
                </ul>
              </TargetConfigurationGroupContainer>
            );
          })}
        <TargetConfigurationGroupContainer
          targetGroupName="Others"
          targetsNumber={targetsGroup.targets.length}
          key="others-group"
        >
          <ul className={`p-2 ${className}`}>
            {targetsGroup.targets.map((targetName) => {
              return (
                <TargetConfigurationDetailsListItem
                  project={project}
                  sourceMap={sourceMap}
                  connectedToCloud={connectedToCloud}
                  disabledTaskSyncGenerators={disabledTaskSyncGenerators}
                  variant={variant}
                  onRunTarget={onRunTarget}
                  onViewInTaskGraph={onViewInTaskGraph}
                  onNxConnect={onNxConnect}
                  targetName={targetName}
                  collapsable={true}
                  key={targetName}
                />
              );
            })}
          </ul>
        </TargetConfigurationGroupContainer>
      </>
    );
  } else if (targetsGroup.targets.length > 0) {
    return (
      <ul className={className}>
        {targetsGroup.targets.map((targetName) => {
          return (
            <TargetConfigurationDetailsListItem
              project={project}
              sourceMap={sourceMap}
              connectedToCloud={connectedToCloud}
              disabledTaskSyncGenerators={disabledTaskSyncGenerators}
              variant={variant}
              onRunTarget={onRunTarget}
              onViewInTaskGraph={onViewInTaskGraph}
              onNxConnect={onNxConnect}
              targetName={targetName}
              collapsable={true}
              key={targetName}
            />
          );
        })}
      </ul>
    );
  } else {
    return (
      <div className="pt-4">
        <p className="mb-2">No targets configured.</p>
        <p>
          There are two ways to create targets:
          <ul className="ml-6 mt-2 list-disc space-y-2">
            <li>
              <a
                href="https://nx.dev/plugin-registry"
                className="text-slate-500 hover:underline dark:text-slate-400"
              >
                Add an Nx plugin
              </a>{' '}
              that{' '}
              <a
                href="https://nx.dev/concepts/inferred-tasks"
                className="text-slate-500 hover:underline dark:text-slate-400"
              >
                infers targets for you
              </a>
            </li>
            <li>
              Manually define targets in the{' '}
              <a
                href="https://nx.dev/reference/project-configuration#task-definitions-targets"
                className="text-slate-500 hover:underline dark:text-slate-400"
              >
                project configuration targets property
              </a>
            </li>
          </ul>
        </p>
      </div>
    );
  }
}
