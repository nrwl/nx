import { Tag } from '@nx/graph/ui-components';

export interface ProjectEdgeNodeTooltipProps {
  type: string;
  source: string;
  target: string;
  fileDependencies: Array<{ fileName: string }>;
  description?: string;
}

export function ProjectEdgeNodeTooltip({
  type,
  source,
  target,
  fileDependencies,
  description,
}: ProjectEdgeNodeTooltipProps) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-400">
      <h4 className={type !== 'implicit' ? 'mb-3' : ''}>
        <Tag className="mr-3">{type ?? 'unknown'}</Tag>
        <span className="font-mono">
          {source} &rarr; {target}
        </span>
      </h4>
      {description ? <p>{description}</p> : null}
      {type !== 'implicit' && fileDependencies?.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
          <div className="bg-slate-50 px-4 py-2 text-xs font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <span>Files</span>
          </div>
          <ul className="max-h-[300px] divide-y divide-slate-200 overflow-auto dark:divide-slate-800">
            {fileDependencies.map((fileDep) => (
              <li
                key={fileDep.fileName}
                className="whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-300"
              >
                <span className="block truncate font-normal">
                  {fileDep.fileName}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
