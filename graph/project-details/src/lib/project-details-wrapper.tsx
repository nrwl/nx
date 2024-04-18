/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
import { useNavigate, useNavigation, useSearchParams } from 'react-router-dom';
import { connect } from 'react-redux';
import {
  getExternalApiService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph/shared';
import { Spinner } from '@nx/graph/ui-components';

import {
  ProjectDetails,
  defaultSelectTargetGroup,
  getTargetGroupForTarget,
} from '@nx/graph/ui-project-details';
import { useCallback, useEffect } from 'react';
import {
  mapStateToProps,
  mapDispatchToProps,
  mapStateToPropsType,
  mapDispatchToPropsType,
} from './project-details-wrapper.state';

type ProjectDetailsProps = mapStateToPropsType &
  mapDispatchToPropsType & {
    project: ProjectGraphProjectNode;
    sourceMap: Record<string, string[]>;
  };

export function ProjectDetailsWrapperComponent({
  project,
  sourceMap,
  setExpandTargets,
  expandTargets,
  getSelectedTarget,
  selectTarget,
  clearTargetGroup,
  collapseAllTargets,
}: ProjectDetailsProps) {
  const environment = useEnvironmentConfig()?.environment;
  const externalApiService = getExternalApiService();
  const navigate = useNavigate();
  const { state: navigationState, location } = useNavigation();
  const routeConstructor = useRouteConstructor();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleViewInProjectGraph = useCallback(
    (data: { projectName: string }) => {
      if (environment === 'nx-console') {
        externalApiService.postEvent({
          type: 'open-project-graph',
          payload: {
            projectName: data.projectName,
          },
        });
      } else {
        navigate(
          routeConstructor(
            `/projects/${encodeURIComponent(data.projectName)}`,
            true
          )
        );
      }
    },
    [externalApiService, routeConstructor, navigate, environment]
  );

  const handleViewInTaskGraph = useCallback(
    (data: { projectName: string; targetName: string }) => {
      if (environment === 'nx-console') {
        externalApiService.postEvent({
          type: 'open-task-graph',
          payload: {
            projectName: data.projectName,
            targetName: data.targetName,
          },
        });
      } else {
        navigate(
          routeConstructor(
            {
              pathname: `/tasks/${encodeURIComponent(data.targetName)}`,
              search: `?projects=${encodeURIComponent(data.projectName)}`,
            },
            true
          )
        );
      }
    },
    [externalApiService, routeConstructor, navigate, environment]
  );

  const handleRunTarget = useCallback(
    (data: { projectName: string; targetName: string }) => {
      externalApiService.postEvent({
        type: 'run-task',
        payload: { taskId: `${data.projectName}:${data.targetName}` },
      });
    },
    [externalApiService]
  );

  const updateSearchParams = (
    params: URLSearchParams,
    targetGroup: string | null,
    targetNames: string[]
  ) => {
    if (targetGroup) {
      params.set('targetGroup', targetGroup);
    } else {
      params.delete('targetGroup');
    }
    if (targetNames.length === 0) {
      params.delete('targetName');
    } else {
      params.set('targetName', targetNames.join(','));
    }
  };

  /* useEffect(() => {
    if (!project.data.targets) return;

    const selectedTargetNameParam = searchParams.get('targetName');
    if (
      selectedTargetNameParam &&
      selectedTarget !== selectedTargetNameParam
    ) {
      selectTarget(selectedTargetNameParam);
    }

    const expandedTargetsParams =
      searchParams.get('targetName')?.split(',') || [];
    if (expandedTargetsParams.length > 0) {
      setExpandTargets(expandedTargetsParams);
    }

    const targetName = searchParams.get('targetName');
    if (targetName) {
      const targetGroup = getTargetGroupForTarget(targetName, project);
      selectTarget(targetGroup);
      setExpandTargets([targetName]);
    }

    return () => {
      clearTargetGroup();
      collapseAllTargets();
      searchParams.delete('targetGroup');
      searchParams.delete('targetName');
      setSearchParams(searchParams, { replace: true });
    };
  }, []); // only run on mount
  

  useEffect(() => {
    if (!project.data.targets) return;

    const selectedTargetGroupParams = searchParams.get('targetGroup');
    const expandedTargetsParams =
      searchParams.get('targetName')?.split(',') || [];

    if (
      selectedTargetGroup === selectedTargetGroupParams &&
      expandedTargetsParams.join(',') === expandTargets.join(',')
    ) {
      return;
    }

    setSearchParams(
      (currentSearchParams) => {
        updateSearchParams(
          currentSearchParams,
          selectedTargetGroup,
          expandTargets
        );
        return currentSearchParams;
      },
      { replace: true, preventScrollReset: true }
    );
  }, [
    expandTargets,
    selectedTargetGroup,
    project.data.targets,
    setExpandTargets,
    searchParams,
    setSearchParams,
  ]);
  */

  if (
    navigationState === 'loading' &&
    !location.pathname.includes('project-details') // do not show spinner when updating search params
  ) {
    return (
      <div className="flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <ProjectDetails
      project={project}
      sourceMap={sourceMap}
      onViewInProjectGraph={handleViewInProjectGraph}
      onViewInTaskGraph={handleViewInTaskGraph}
      onRunTarget={environment === 'nx-console' ? handleRunTarget : undefined}
    />
  );
}

export const ProjectDetailsWrapper = connect(
  mapStateToProps,
  mapDispatchToProps
)(ProjectDetailsWrapperComponent);
export default ProjectDetailsWrapper;
