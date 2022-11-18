import { getProjectGraphService } from '../machines/get-services';
import { FlagIcon, MapPinIcon } from '@heroicons/react/24/solid';
import Tag from '../ui-components/tag';
import { TooltipButton } from './tooltip-button';

export interface ProjectNodeToolTipProps {
  type: 'app' | 'lib' | 'e2e';
  id: string;
  tags: string[];
}

export function ProjectNodeToolTip({
  type,
  id,
  tags,
}: ProjectNodeToolTipProps) {
  const projectGraphService = getProjectGraphService();

  function onFocus() {
    projectGraphService.send({
      type: 'focusProject',
      projectName: id,
    });
  }

  function onExclude() {
    projectGraphService.send({
      type: 'deselectProject',
      projectName: id,
    });
  }

  function onStartTrace() {
    projectGraphService.send({
      type: 'setTracingStart',
      projectName: id,
    });
  }

  function onEndTrace() {
    projectGraphService.send({
      type: 'setTracingEnd',
      projectName: id,
    });
  }

  return (
    <div>
      <h4>
        <Tag className="mr-3">{type}</Tag>
        {id}
      </h4>
      {tags.length > 0 ? (
        <p>
          <strong>tags</strong>
          <br></br>
          {tags.join(', ')}
        </p>
      ) : null}
      <div className="flex">
        <TooltipButton onClick={onFocus}>Focus</TooltipButton>
        <TooltipButton onClick={onExclude}>Exclude</TooltipButton>
        <TooltipButton
          className="flex flex-row items-center"
          onClick={onStartTrace}
        >
          <MapPinIcon className="mr-2 h-5 w-5 text-slate-500"></MapPinIcon>
          Start
        </TooltipButton>
        <TooltipButton
          className="flex flex-row items-center"
          onClick={onEndTrace}
        >
          <FlagIcon className="mr-2 h-5 w-5 text-slate-500"></FlagIcon>
          End
        </TooltipButton>
      </div>
    </div>
  );
}

export default ProjectNodeToolTip;
