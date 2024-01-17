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
        if (currentTooltip.props.openConfigCallback) {
          return currentTooltip.props.openConfigCallback;
        }

        if (environment !== 'nx-console') {
          return () => {
            navigate(
              routeConstructor(
                {
                  pathname: `/project-details/${currentTooltip.props.id}`,
                },
                false
              )
            );
          };
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
      tooltipToRender = (
        <TaskNodeTooltip {...currentTooltip.props}>
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
