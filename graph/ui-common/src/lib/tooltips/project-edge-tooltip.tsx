import cn from 'classnames';
import { Tag } from '../tag';

export interface ProjectEdgeNodeTooltipFileDependencies {
  nodeType: 'projectEdge';
  fileDependencies: Array<{ fileName: string }>;
}

export interface CompositeEdgeNodeTooltipFileDependencies {
  nodeType: 'compositeEdge';
  fileDependencies: Record<string, Array<{ fileName: string }>>;
}

export type ProjectEdgeNodeTooltipProps = {
  type: string;
  source: string;
  target: string;
  description?: string;
  renderMode?: 'nx-console' | 'nx-docs' | 'nx-cloud';
  sourceRoot?: string;
  fileClickCallback?: (fileName: string) => void;
} & (
  | ProjectEdgeNodeTooltipFileDependencies
  | CompositeEdgeNodeTooltipFileDependencies
);

export function ProjectEdgeNodeTooltip({
  type,
  source,
  target,
  nodeType,
  fileDependencies,
  description,
  fileClickCallback,
}: ProjectEdgeNodeTooltipProps) {
  const hasDependencies =
    (nodeType === 'projectEdge' && fileDependencies?.length > 0) ||
    (nodeType === 'compositeEdge' && Object.keys(fileDependencies).length > 0);

  return (
    <div className="text-sm text-slate-700 dark:text-slate-400">
      <h4 className={type !== 'implicit' ? 'mb-3' : ''}>
        <Tag className="mr-3">{type ?? 'unknown'}</Tag>
        <span className="font-mono">
          {source} &rarr; {target}
        </span>
      </h4>
      {description ? <p>{description}</p> : null}
      {type !== 'implicit' && hasDependencies ? (
        <div
          className={cn(
            'rounded-md border border-slate-200 dark:border-slate-800',
            {
              'overflow-hidden': nodeType === 'projectEdge',
              'max-h-[432px] overflow-auto': nodeType === 'compositeEdge',
            }
          )}
        >
          {nodeType === 'projectEdge' ? (
            <>
              <div className="bg-slate-50 px-4 py-2 text-xs font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <span>Files</span>
              </div>
              <DependencyList
                fileDependencies={fileDependencies}
                fileClickCallback={fileClickCallback}
              />
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(fileDependencies).map(
                ([source, dependencies]) => (
                  <div key={source}>
                    <div className="bg-slate-50 px-4 py-2 text-xs font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <span>{source}</span>
                    </div>
                    <DependencyList
                      fileDependencies={dependencies}
                      fileClickCallback={fileClickCallback}
                    />
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DependencyList({
  fileDependencies,
  fileClickCallback,
}: {
  fileDependencies: Array<{ fileName: string }>;
  fileClickCallback?: (fileName: string) => void;
}) {
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {fileDependencies.map((fileDep) => (
        <li
          key={fileDep.fileName}
          className={`whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-300 ${
            fileClickCallback !== undefined
              ? 'hover:cursor-pointer hover:underline'
              : ''
          }`}
          onClick={
            fileClickCallback !== undefined
              ? () => fileClickCallback(fileDep.fileName)
              : // eslint-disable-next-line @typescript-eslint/no-empty-function
                () => {}
          }
        >
          <span className="block truncate font-normal">{fileDep.fileName}</span>
        </li>
      ))}
    </ul>
  );
}
