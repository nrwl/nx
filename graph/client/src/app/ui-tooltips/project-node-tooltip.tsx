import { getProjectGraphService } from '../machines/get-services';
import { FlagIcon, MapPinIcon } from '@heroicons/react/24/solid';
import Tag from '../ui-components/tag';
import { TooltipButton, TooltipLinkButton } from './tooltip-button';
import { useRouteConstructor } from '../util';
import { useNavigate } from 'react-router-dom';

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
  const { start, end, algorithm } =
    projectGraphService.getSnapshot().context.tracing;
  const routeConstructor = useRouteConstructor();
  const navigate = useNavigate();

  function onExclude() {
    projectGraphService.send({
      type: 'deselectProject',
      projectName: id,
    });
    navigate(routeConstructor('/projects', true));
  }

  function onStartTrace() {
    navigate(routeConstructor(`/projects/trace/${id}`, true));
  }

  function onEndTrace() {
    navigate(routeConstructor(`/projects/trace/${start}/${id}`, true));
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
        <TooltipLinkButton to={routeConstructor(`/projects/${id}`, true)}>
          Focus
        </TooltipLinkButton>
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
      </div>
    </div>
  );
}

export default ProjectNodeToolTip;
