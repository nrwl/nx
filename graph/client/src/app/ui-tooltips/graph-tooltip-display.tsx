import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
  getProjectGraphService,
  getTooltipService,
} from '../machines/get-services';
import {
  CompositeNodeTooltip,
  CompositeNodeTooltipActions,
  NodeTooltipAction,
  ProjectEdgeNodeTooltip,
  ProjectNodeToolTip,
  ProjectNodeTooltipActions,
  TaskNodeTooltip,
  Tooltip,
} from '@nx/graph/ui-tooltips';
import { TaskNodeActions } from './task-node-actions';
import { getExternalApiService, useRouteConstructor } from '@nx/graph/shared';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

const tooltipService = getTooltipService();

export function TooltipDisplay() {
  const navigate = useNavigate();
  const routeConstructor = useRouteConstructor();
  const externalApiService = getExternalApiService();
  const projectGraphService = getProjectGraphService();

  const currentTooltip = useSyncExternalStore(
    (callback) => tooltipService.subscribe(callback),
    () => tooltipService.currentTooltip
  );

  const onAction = useCallback(
    (action: NodeTooltipAction) => {
      switch (action.type) {
        case 'expand-node':
          projectGraphService.send({
            type: 'expandCompositeNode',
            id: action.id,
          });
          break;
        case 'focus-node': {
          if (action.tooltipNodeType === 'compositeNode') {
            navigate(
              routeConstructor(
                { pathname: `/projects`, search: `?composite=${action.id}` },
                true
              )
            );
          } else {
            navigate(routeConstructor(`/projects/${action.id}`, true));
          }
          break;
        }
        case 'collapse-node':
          projectGraphService.send({
            type: 'collapseCompositeNode',
            id: action.id,
          });

          break;
        case 'exclude-node':
          projectGraphService.send({
            type: 'deselectProject',
            projectName:
              action.tooltipNodeType === 'projectNode'
                ? action.rawId
                : action.id,
          });
          if (action.tooltipNodeType === 'projectNode') {
            navigate(routeConstructor('/projects', true));
          }
          break;
        case 'start-trace':
          navigate(routeConstructor(`/projects/trace/${action.id}`, true));
          break;
        case 'end-trace': {
          const { start } = projectGraphService.getSnapshot().context.tracing;
          navigate(
            routeConstructor(
              `/projects/trace/${encodeURIComponent(start)}/${action.id}`,
              (searchParams) => {
                if (searchParams.has('composite')) {
                  searchParams.delete('composite');
                }
                return searchParams;
              }
            )
          );
          break;
        }
      }
    },
    [projectGraphService, navigate, routeConstructor]
  );

  let tooltipToRender;
  if (currentTooltip) {
    if (currentTooltip.type === 'projectNode') {
      const onConfigClick =
        currentTooltip.props.renderMode === 'nx-docs'
          ? undefined
          : (() => {
              if (currentTooltip.props.renderMode !== 'nx-console') {
                return () => {
                  navigate(
                    routeConstructor(
                      {
                        pathname: `/project-details/${encodeURIComponent(
                          currentTooltip.props.id
                        )}`,
                      },
                      false
                    )
                  );
                };
              } else {
                return () =>
                  externalApiService.postEvent({
                    type: 'open-project-config',
                    payload: {
                      projectName: currentTooltip.props.id,
                    },
                  });
              }
            })();

      tooltipToRender = (
        <ProjectNodeToolTip
          {...currentTooltip.props}
          openConfigCallback={onConfigClick}
        >
          <ProjectNodeTooltipActions
            onAction={onAction}
            {...currentTooltip.props}
          />
        </ProjectNodeToolTip>
      );
    } else if (currentTooltip.type === 'compositeNode') {
      tooltipToRender = (
        <CompositeNodeTooltip {...currentTooltip.props}>
          <CompositeNodeTooltipActions
            onAction={onAction}
            {...currentTooltip.props}
          />
        </CompositeNodeTooltip>
      );
    } else if (currentTooltip.type === 'projectEdge') {
      const onFileClick =
        currentTooltip.props.renderMode === 'nx-console'
          ? (url) =>
              externalApiService.postEvent({
                type: 'file-click',
                payload: {
                  url: `${currentTooltip.props.sourceRoot}/${url}`,
                },
              })
          : undefined;
      tooltipToRender = (
        <ProjectEdgeNodeTooltip
          {...currentTooltip.props}
          fileClickCallback={onFileClick}
        />
      );
    } else if (currentTooltip.type === 'taskNode') {
      const onRunTaskClick =
        currentTooltip.props.renderMode === 'nx-console'
          ? () =>
              externalApiService.postEvent({
                type: 'run-task',
                payload: {
                  taskId: currentTooltip.props.id,
                },
              })
          : undefined;
      const onConfigClick = (() => {
        const [projectName, targetName] = currentTooltip.props.id.split(':');
        if (currentTooltip.props.renderMode !== 'nx-console') {
          return () => {
            navigate(
              routeConstructor(
                {
                  pathname: `/project-details/${encodeURIComponent(
                    projectName
                  )}`,
                  search: `expanded=${targetName}`,
                },
                false
              )
            );
          };
        } else {
          return () =>
            externalApiService.postEvent({
              type: 'open-project-config',
              payload: {
                projectName,
                targetName,
              },
            });
        }
      })();

      tooltipToRender = (
        <TaskNodeTooltip
          {...currentTooltip.props}
          openConfigCallback={onConfigClick}
          runTaskCallback={onRunTaskClick}
        >
          <TaskNodeActions {...currentTooltip.props} />
        </TaskNodeTooltip>
      );
    }
  }

  return tooltipToRender ? (
    <Tooltip
      content={tooltipToRender}
      open={true}
      reference={currentTooltip.ref}
      placement="top"
      openAction="manual"
    ></Tooltip>
  ) : null;
}
