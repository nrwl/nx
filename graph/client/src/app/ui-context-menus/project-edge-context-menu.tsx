import type { ProjectEdgeElementData } from '@nx/graph';
import { Tag } from '@nx/graph-ui-common';
import { useMemo } from 'react';
import { ContextMenuList } from './context-menu-list';
import { extractDependencyTarget } from '../util';

export function ProjectEdgeContextMenu({
  data,
}: {
  data: ProjectEdgeElementData;
}) {
  const edgeLabel = useMemo(() => {
    return data.sourceData.name + ' → ' + data.targetData.name;
  }, [data.sourceData.name, data.targetData.name]);

  const fileDependencies = useMemo(() => {
    const dependencies: string[] = [];

    if (!data.sourceData.files) return dependencies;

    for (const fileData of data.sourceData.files) {
      if (!fileData.deps) continue;

      // Check if any dependency points to our target project
      const hasTargetDep = fileData.deps.find((dep) => {
        const depTarget = extractDependencyTarget(dep);
        return (
          depTarget === data.targetData.name || depTarget === data.targetData.id
        );
      });

      if (!hasTargetDep) continue;

      // Remove the project root from the file path to get relative path
      const fileName = fileData.file.startsWith(data.sourceData.root + '/')
        ? fileData.file.slice(data.sourceData.root.length + 1)
        : fileData.file;

      dependencies.push(fileName);
    }

    return dependencies;
  }, [data.sourceData, data.targetData]);

  return (
    <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      <div className="flex items-center gap-2">
        <Tag>{data.depType ?? 'unknown'}</Tag>
        <span className="font-mono">{edgeLabel}</span>
      </div>
      <ContextMenuList sections={{ label: 'Files', items: fileDependencies }} />
    </div>
  );
}
