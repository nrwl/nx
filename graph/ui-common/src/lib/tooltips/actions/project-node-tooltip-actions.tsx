import { FlagIcon, MapPinIcon } from '@heroicons/react/24/solid';
import type { ProjectNodeToolTipProps } from '../project-node-tooltip';
import { TooltipButton } from '../tooltip-button';
import type { NodeTooltipAction } from './tooltip-actions';

export interface ProjectNodeTooltipActionsProps
  extends ProjectNodeToolTipProps {
  onAction?: (action: NodeTooltipAction) => void;
}

export function ProjectNodeTooltipActions({
  id,
  start,
  onAction,
  children,
}: ProjectNodeTooltipActionsProps) {
  const encodedId = encodeURIComponent(id);

  // function onProjectDetails() {
  //   setSearchParams({ projectDetails: id });
  // }

  function onFocus() {
    onAction?.({
      type: 'focus-node',
      rawId: id,
      id: encodedId,
      tooltipNodeType: 'projectNode',
    });
  }

  function onExclude() {
    onAction?.({
      type: 'exclude-node',
      rawId: id,
      id: encodedId,
      tooltipNodeType: 'projectNode',
    });
  }

  function onStartTrace() {
    onAction?.({
      type: 'start-trace',
      rawId: id,
      id: encodedId,
      tooltipNodeType: 'projectNode',
    });
  }

  function onEndTrace() {
    onAction?.({
      type: 'end-trace',
      rawId: id,
      id: encodedId,
      tooltipNodeType: 'projectNode',
    });
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <TooltipButton onClick={onFocus}>Focus</TooltipButton>
      <TooltipButton onClick={onExclude}>Exclude</TooltipButton>

      {!start ? (
        <TooltipButton
          className="flex flex-row items-center"
          onClick={onStartTrace}
        >
          <MapPinIcon className="mr-2 h-5 w-5 text-slate-500"></MapPinIcon>
          Start
        </TooltipButton>
      ) : (
        <TooltipButton
          className="flex flex-row items-center"
          onClick={onEndTrace}
        >
          <FlagIcon className="mr-2 h-5 w-5 text-slate-500"></FlagIcon>
          End
        </TooltipButton>
      )}
      {children ? children : null}
    </div>
  );
}
