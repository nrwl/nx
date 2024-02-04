// eslint-disable-next-line @typescript-eslint/no-unused-vars

import { useNavigate, useSearchParams } from 'react-router-dom';

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphProjectNode } from '@nx/devkit';
import {
  getExternalApiService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph/shared';
import {
  ProjectDetails,
  ProjectDetailsImperativeHandle,
} from '@nx/graph/ui-project-details';
import { useCallback, useLayoutEffect, useRef } from 'react';

export interface ProjectDetailsProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
}

export function ProjectDetailsWrapper(props: ProjectDetailsProps) {
  const projectDetailsRef = useRef<ProjectDetailsImperativeHandle>(null);
  const environment = useEnvironmentConfig()?.environment;
  const externalApiService = getExternalApiService();
  const navigate = useNavigate();
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

  const updateSearchParams = (params: URLSearchParams, sections: string[]) => {
    if (sections.length === 0) {
      params.delete('expanded');
    } else {
      params.set('expanded', sections.join(','));
    }
  };

  const handleTargetCollapse = useCallback(
    (targetName: string) => {
      const expandedSections = searchParams.get('expanded')?.split(',') || [];
      if (!expandedSections.includes(targetName)) return;
      const newExpandedSections = expandedSections.filter(
        (section) => section !== targetName
      );
      setSearchParams(
        (currentSearchParams) => {
          updateSearchParams(currentSearchParams, newExpandedSections);
          return currentSearchParams;
        },
        {
          replace: true,
          preventScrollReset: true,
        }
      );
    },
    [setSearchParams, searchParams]
  );

  const handleTargetExpand = useCallback(
    (targetName: string) => {
      const expandedSections = searchParams.get('expanded')?.split(',') || [];
      if (expandedSections.includes(targetName)) return;
      expandedSections.push(targetName);
      setSearchParams(
        (currentSearchParams) => {
          updateSearchParams(currentSearchParams, expandedSections);
          return currentSearchParams;
        },
        { replace: true, preventScrollReset: true }
      );
    },
    [setSearchParams, searchParams]
  );

  useLayoutEffect(() => {
    if (!props.project.data.targets) return;

    const expandedSections = searchParams.get('expanded')?.split(',') || [];
    for (const targetName of Object.keys(props.project.data.targets)) {
      if (expandedSections.includes(targetName)) {
        projectDetailsRef.current?.expandTarget(targetName);
      } else {
        projectDetailsRef.current?.collapseTarget(targetName);
      }
    }
  }, [searchParams, props.project.data.targets, projectDetailsRef]);

  return (
    <ProjectDetails
      ref={projectDetailsRef}
      {...props}
      onTargetCollapse={handleTargetCollapse}
      onTargetExpand={handleTargetExpand}
      onViewInProjectGraph={handleViewInProjectGraph}
      onViewInTaskGraph={handleViewInTaskGraph}
      onRunTarget={environment === 'nx-console' ? handleRunTarget : undefined}
    />
  );
}

export default ProjectDetailsWrapper;
