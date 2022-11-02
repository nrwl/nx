import Tag from '../ui-components/tag';

export interface EdgeNodeTooltipProps {
  type: string;
  source: string;
  target: string;
  fileDependencies: Array<{ fileName: string }>;
}

export function EdgeNodeTooltip({
  type,
  source,
  target,
  fileDependencies,
}: EdgeNodeTooltipProps) {
  return (
    <div>
      <h4 className={type !== 'implicit' ? 'mb-3' : ''}>
        <Tag>{type ?? 'unknown'}</Tag>
        {source} &rarr; {target}
      </h4>
      {type !== 'implicit' ? (
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

export default EdgeNodeTooltip;
