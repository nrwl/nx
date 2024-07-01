import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { getTooltipService } from '../machines/get-services';
import {
  ProjectEdgeNodeTooltip,
  ProjectNodeToolTip,
  TaskNodeTooltip,
  Tooltip,
} from '@nx/graph/ui-tooltips';
import { ProjectNodeActions } from './project-node-actions';
import { TaskNodeActions } from './task-node-actions';
import { getExternalApiService, useRouteConstructor } from '@nx/graph/shared';
import { useNavigate } from 'react-router-dom';

const tooltipService = getTooltipService();

export function TooltipDisplay() {
  const navigate = useNavigate();
  const routeConstructor = useRouteConstructor();
  const externalApiService = getExternalApiService();

  const currentTooltip = useSyncExternalStore(
    (callback) => tooltipService.subscribe(callback),
    () => tooltipService.currentTooltip
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
          <ProjectNodeActions {...currentTooltip.props} />
        </ProjectNodeToolTip>
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
