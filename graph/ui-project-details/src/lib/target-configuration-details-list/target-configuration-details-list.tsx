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
import { useEffect } from 'react';
import { groupTargets } from '../utils/group-targets';
import { TargetConfigurationDetailsListItem } from '../target-configuration-details-list-item/target-configuration-details-list-item';
import { TargetConfigurationGroupList } from '../target-configuration-details-group-list/target-configuration-details-group-list';

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
  selectedTarget,
}: TargetConfigurationDetailsListProps) {
  if (selectedTarget) {
    return (
      <TargetConfigurationDetailsListItem
        project={project}
        sourceMap={sourceMap}
        variant={variant}
        onRunTarget={onRunTarget}
        onViewInTaskGraph={onViewInTaskGraph}
        targetName={selectedTarget}
        collapsable={false}
      />
    );
  }

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

export const TargetConfigurationDetailsList = connect(
  mapStateToProps,
  mapDispatchToProps
)(TargetConfigurationDetailsListComponent);
export default TargetConfigurationDetailsList;
