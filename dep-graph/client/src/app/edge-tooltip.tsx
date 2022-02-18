export interface EdgeNodeTooltipProps {
  type: 'static' | 'dynamic' | 'implicit';
  source: string;
  target: string;
  fileDependencies: Array<{ fileName: string }>;
}
function EdgeNodeTooltip({
  type,
  source,
  target,
  fileDependencies,
}: EdgeNodeTooltipProps) {
  return (
    <div>
      <h4>
        <span className="tag">{type ?? 'unknown'}</span>
        {source} &rarr; {target}
      </h4>
      {type !== 'implicit' ? (
        <div className="rounded-lg border border-gray-200">
          <div className="rounded-tl-lg rounded-tr-lg bg-gray-50 px-4 py-2 text-xs font-medium uppercase text-gray-500">
            <span>Files</span>
          </div>
          <ul className="max-h-[300px] divide-y divide-gray-200 overflow-auto">
            {fileDependencies.map((fileDep) => (
              <li className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-900 ">
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
