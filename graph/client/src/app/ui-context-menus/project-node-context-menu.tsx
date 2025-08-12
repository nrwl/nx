import type { ProjectNodeElementData, RenderPlatform } from '@nx/graph';
import { Tag, TooltipButton } from '@nx/graph-ui-common';
import {
  DocumentMagnifyingGlassIcon,
  FlagIcon,
  MapPinIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

export interface ProjectNodeContextMenuProps {
  data: ProjectNodeElementData;
  renderPlatform: RenderPlatform;
  onConfigClick: () => void;
  onAction: (action: {
    type: 'focus-node' | 'start-trace' | 'end-trace' | 'exclude-node';
  }) => void;
  tracingStart?: string;
}

export function ProjectNodeContextMenu({
  data,
  renderPlatform,
  onConfigClick,
  onAction,
  tracingStart,
}: ProjectNodeContextMenuProps) {
  return (
    <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag>{data.projectType}</Tag>
          <span className="font-mono">{data.label}</span>
        </div>

        <button
          className="shadow-xs flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
          onClick={onConfigClick}
          title={
            renderPlatform === 'nx-console'
              ? 'Open project details in editor'
              : 'Open project details'
          }
        >
          {renderPlatform === 'nx-console' ? (
            <PencilSquareIcon className="h-5 w-5" />
          ) : (
            <DocumentMagnifyingGlassIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      {data.tags.length > 0 ? (
        <p className="my-2 lowercase">
          <strong>tags</strong>
          <br />
          {data.tags.join(', ')}
        </p>
      ) : null}
      {data.description ? <p className="mt-4">{data.description}</p> : null}
      <ProjectNodeContextMenuActions
        data={data}
        tracingStart={tracingStart}
        onAction={onAction}
      />
    </div>
  );
}

interface ProjectNodeContextMenuActionsProps {
  data: ProjectNodeElementData;
  tracingStart?: string;
  onAction: (action: {
    type: 'focus-node' | 'exclude-node' | 'start-trace' | 'end-trace';
  }) => void;
}

function ProjectNodeContextMenuActions({
  tracingStart,
  onAction,
}: ProjectNodeContextMenuActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <TooltipButton onClick={() => onAction({ type: 'focus-node' })}>
        Focus
      </TooltipButton>
      <TooltipButton onClick={() => onAction({ type: 'exclude-node' })}>
        Exclude
      </TooltipButton>

      {!tracingStart ? (
        <TooltipButton
          className="flex flex-row items-center"
          onClick={() => onAction({ type: 'start-trace' })}
        >
          <MapPinIcon className="mr-2 h-5 w-5 text-slate-500 dark:text-slate-400"></MapPinIcon>
          Start
        </TooltipButton>
      ) : (
        <TooltipButton
          className="flex flex-row items-center"
          onClick={() => onAction({ type: 'end-trace' })}
        >
          <FlagIcon className="mr-2 h-5 w-5 text-slate-500 dark:text-slate-400"></FlagIcon>
          End
        </TooltipButton>
      )}
    </div>
  );
}
