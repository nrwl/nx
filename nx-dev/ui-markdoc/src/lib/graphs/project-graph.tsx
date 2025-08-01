'use client';

import type {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';
import { useEffect } from 'react';
import { RenderTheme } from '@nx/graph';
import { useProjectGraphClient } from '@nx/graph/projects';
import {
  NxGraphContextMenu,
  useGraphContextMenu,
} from '@nx/graph/context-menu';
import { Tag } from '@nx/graph-ui-common';
import { resolveTheme } from './resolve-theme';

interface NxDevProjectGraphProps {
  theme: RenderTheme | 'system';
  projects: ProjectGraphProjectNode[];
  dependencies: Record<string, ProjectGraphDependency[]>;
  affectedProjects: string[];
  enableContextMenu?: boolean;
  composite?: boolean;
}

export function NxDevProjectGraph({
  projects,
  dependencies,
  affectedProjects,
  theme = 'system',
  composite = false,
  enableContextMenu = false,
}: NxDevProjectGraphProps) {
  const { containerRef, graphClient, sendRenderConfigEvent, send } =
    useProjectGraphClient({
      renderPlatform: 'nx-dev',
      styles: [],
    });

  const { graphMenu } = useGraphContextMenu({
    renderGraphEventBus: enableContextMenu ? graphClient : null,
  });

  useEffect(() => {
    sendRenderConfigEvent({ type: 'ThemeChange', theme: resolveTheme(theme) });
  }, [theme]);

  useEffect(() => {
    if (!graphClient) return;

    send({ type: 'initGraph', projects, dependencies, affectedProjects });

    if (composite) {
      send({ type: 'toggleCompositeGraph', composite: true });
    }

    send({
      type: affectedProjects.length ? 'showAffected' : 'showAll',
      autoExpand: composite,
    });
  }, [graphClient]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="flex h-full w-full cursor-pointer"
      ></div>

      {graphMenu ? (
        <NxGraphContextMenu
          menu={graphMenu.props}
          virtualElement={graphMenu.virtualElement}
          placement="top"
          menuItemsContainerClassName="dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
        >
          {{
            project: ({ data }) => (
              <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <Tag>{data.projectType}</Tag>
                  <span className="font-mono">{data.label}</span>
                </div>
                {data.tags.length > 0 ? (
                  <p className="my-2 lowercase">
                    <strong>tags</strong>
                    <br></br>
                    {data.tags.join(', ')}
                  </p>
                ) : null}
                {data.description ? (
                  <p className="mt-4">{data.description}</p>
                ) : null}
              </div>
            ),
            compositeProject: ({ data }) => (
              <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <Tag>Composite</Tag>
                  <span className="font-mono">{data.label}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {data.compositeSize > 0 && (
                    <p>
                      <strong>Nested directories: </strong>
                      {data.compositeSize}
                    </p>
                  )}
                  {data.projectSize > 0 && (
                    <p>
                      <strong>Projects: </strong>
                      {data.projectSize}
                    </p>
                  )}
                </div>
              </div>
            ),
          }}
        </NxGraphContextMenu>
      ) : null}
    </div>
  );
}
