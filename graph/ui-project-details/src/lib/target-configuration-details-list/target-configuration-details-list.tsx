import { connect } from 'react-redux';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
import TargetConfigurationDetails from '../target-configuration-details/target-configuration-details';
import {
  mapDispatchToProps,
  mapDispatchToPropsType,
  mapStateToProps,
  mapStateToPropsType,
} from './target-configuration-details-list.state';
import { useEffect, useState } from 'react';

export type TargetConfigurationDetailsListProps = mapStateToPropsType &
  mapDispatchToPropsType & {
    project: ProjectGraphProjectNode;
    sourceMap: Record<string, string[]>;
    variant?: 'default' | 'compact';
    onRunTarget?: (data: { projectName: string; targetName: string }) => void;
    onViewInTaskGraph?: (data: {
      projectName: string;
      targetName: string;
    }) => void;
    className?: string;
  };

export function TargetConfigurationDetailsListComponent({
  project,
  variant,
  sourceMap,
  onRunTarget,
  onViewInTaskGraph,
  className,
  selectedTargetGroup,
}: TargetConfigurationDetailsListProps) {
  const [targetsUnderTargetGroup, setTargetsUnderTargetGroup] = useState<
    string[]
  >([]);

  useEffect(() => {
    if (selectedTargetGroup) {
      let targets: string[] = [];
      if (project.data.metadata?.targetGroups) {
        targets = project.data.metadata.targetGroups[selectedTargetGroup] ?? [];
      }
      if (targets.length === 0 && project.data.targets?.[selectedTargetGroup]) {
        targets = [selectedTargetGroup];
      }
      setTargetsUnderTargetGroup(targets);
    }
  }, [
    selectedTargetGroup,
    project.data.metadata?.targetGroups,
    project.data.targets,
  ]);

  return (
    <ul className={className}>
      {targetsUnderTargetGroup.map((targetName) => {
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
              onRunTarget={onRunTarget}
              onViewInTaskGraph={onViewInTaskGraph}
              collapsable={targetsUnderTargetGroup.length > 1}
            />
          </li>
        );
      })}
    </ul>
  );
}

export const TargetConfigurationDetailsList = connect(
  mapStateToProps,
  mapDispatchToProps
)(TargetConfigurationDetailsListComponent);
export default TargetConfigurationDetailsList;
