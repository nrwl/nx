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
import { useEnvironmentConfig, useRouteConstructor } from '@nx/graph/shared';
import { useNavigate } from 'react-router-dom';

const tooltipService = getTooltipService();

export function TooltipDisplay() {
  const environment = useEnvironmentConfig()?.environment;
  const navigate = useNavigate();
  const routeConstructor = useRouteConstructor();

  const currentTooltip = useSyncExternalStore(
    (callback) => tooltipService.subscribe(callback),
    () => tooltipService.currentTooltip
  );

  let tooltipToRender;
  if (currentTooltip) {
    if (currentTooltip.type === 'projectNode') {
      const onConfigClick = (() => {
        if (environment !== 'nx-console') {
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
            this.externalApiService.postEvent({
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
          isNxConsole={environment === 'nx-console'}
        >
          <ProjectNodeActions {...currentTooltip.props} />
        </ProjectNodeToolTip>
      );
    } else if (currentTooltip.type === 'projectEdge') {
      tooltipToRender = <ProjectEdgeNodeTooltip {...currentTooltip.props} />;
    } else if (currentTooltip.type === 'taskNode') {
      const onConfigClick = (() => {
        const [projectName, targetName] = currentTooltip.props.id.split(':');
        if (environment !== 'nx-console') {
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
            this.externalApiService.postEvent({
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
          isNxConsole={environment === 'nx-console'}
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
