import { getDepGraphService } from './machines/dep-graph.service';
import {
  DocumentMagnifyingGlassIcon,
  FlagIcon,
  MapPinIcon,
} from '@heroicons/react/24/solid';

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
  const depGraphService = getDepGraphService();

  function onFocus() {
    depGraphService.send({
      type: 'focusProject',
      projectName: id,
    });
  }

  function onExclude() {
    depGraphService.send({
      type: 'deselectProject',
      projectName: id,
    });
  }

  function onStartTrace() {
    depGraphService.send({
      type: 'setTracingStart',
      projectName: id,
    });
  }

  function onEndTrace() {
    depGraphService.send({
      type: 'setTracingEnd',
      projectName: id,
    });
  }

  return (
    <div>
      <h4>
        <span className="tag">{type}</span>
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
        <button onClick={onFocus}>Focus</button>
        <button onClick={onExclude}>Exclude</button>
        <button className="flex flex-row items-center" onClick={onStartTrace}>
          <MapPinIcon className="mr-2 h-5 w-5 text-slate-500"></MapPinIcon>
          Start
        </button>
        <button className="flex flex-row items-center" onClick={onEndTrace}>
          <FlagIcon className="mr-2 h-5 w-5 text-slate-500"></FlagIcon>
          End
        </button>
      </div>
    </div>
  );
}

export default ProjectNodeToolTip;
