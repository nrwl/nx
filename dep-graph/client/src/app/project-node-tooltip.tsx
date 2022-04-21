import { getDepGraphService } from './machines/dep-graph.service';

export interface ProjectNodeToolTipProps {
  type: 'app' | 'lib' | 'e2e';
  id: string;
  tags: string[];
}
function ProjectNodeToolTip({ type, id, tags }: ProjectNodeToolTipProps) {
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 h-5 w-5 text-slate-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          Start
        </button>
        <button className="flex flex-row items-center" onClick={onEndTrace}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2 h-5 w-5 text-slate-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z"
              clipRule="evenodd"
            />
          </svg>
          End
        </button>
      </div>
    </div>
  );
}

export default ProjectNodeToolTip;
