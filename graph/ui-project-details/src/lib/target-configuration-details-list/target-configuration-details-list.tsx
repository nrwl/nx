import { connect } from 'react-redux';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
import {
  mapDispatchToProps,
  mapDispatchToPropsType,
  mapStateToProps,
  mapStateToPropsType,
} from './target-configuration-details-list.state';
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

export const TargetConfigurationDetailsList = connect(
  mapStateToProps,
  mapDispatchToProps
)(TargetConfigurationDetailsListComponent);
export default TargetConfigurationDetailsList;
