'use client';

import type {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';
import { useEffect, useMemo } from 'react';
import { ElementData, RenderTheme } from '@nx/graph';
import { useProjectGraphOrchestrator } from '@nx/graph/projects';
import { resolveTheme } from './resolve-theme';
import {
  NxGraphCompositeProjectNodePanelContent,
  NxGraphCompositeProjectNodePanelHeader,
  NxGraphElementPanel,
  NxGraphProjectNodePanelContent,
  NxGraphProjectNodePanelHeader,
  useElementPanel,
} from '@nx/graph/ui';

interface NxDevProjectGraphProps {
  theme: RenderTheme | 'system';
  projects: ProjectGraphProjectNode[];
  dependencies?: Record<string, ProjectGraphDependency[]>;
  affectedProjects?: string[];
  enableContextMenu?: boolean;
  composite?: boolean;
}

export function NxDevProjectGraph({
  projects,
  dependencies = {},
  affectedProjects = [],
  theme = 'system',
  composite = false,
  enableContextMenu = false,
}: NxDevProjectGraphProps) {
  const graphContext = useProjectGraphOrchestrator({
    renderPlatform: 'nx-dev',
  });

  const { containerRef, orchestrator, sendRendererConfigEvent, send } =
    graphContext;

  const eventBus = useMemo(
    () => (enableContextMenu ? orchestrator : null),
    [orchestrator, enableContextMenu]
  );

  const [element] = useElementPanel<
    ElementData.ProjectNode | ElementData.CompositeProjectNode
  >(eventBus);

  useEffect(() => {
    sendRendererConfigEvent({
      type: 'themeChange',
      theme: resolveTheme(theme),
    });
  }, [theme]);

  useEffect(() => {
    if (!orchestrator) return;

    send({ type: 'initGraph', projects, dependencies, affectedProjects });

    send({
      type: 'updateRendererConfig',
      updater: (config) => ({
        mode: composite ? 'composite' : 'individual',
        autoExpand: composite ? config.autoExpand : 0,
        showMode: affectedProjects.length ? 'affected' : 'all',
      }),
    });

    send({ type: 'showAll' });
  }, [orchestrator]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="flex h-full w-full cursor-pointer"
      ></div>

      <NxGraphElementPanel
        element={element}
        panelContainerClassName="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        panelHeaderClassName="border-slate-300 dark:border-slate-700"
        panelContentContainerClassName="divide-slate-300 dark:divide-slate-700"
        header={{
          project: (element, { open, close }) => (
            <NxGraphProjectNodePanelHeader
              element={element}
              open={open}
              close={close}
              badgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 uppercase"
              elementNameClassName="text-slate-900 dark:text-slate-100"
              closeButtonClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
            />
          ),
          'composite-project': (element, { open, close }) => (
            <NxGraphCompositeProjectNodePanelHeader
              element={element}
              open={open}
              close={close}
              badgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 uppercase"
              elementNameClassName="text-slate-900 dark:text-slate-100"
              closeButtonClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
            />
          ),
        }}
      >
        {{
          project: (element) => (
            <NxGraphProjectNodePanelContent
              element={element}
              sectionHeadingClassName="text-slate-900 dark:text-slate-100"
              sectionTextClassName="text-slate-700 dark:text-slate-300"
              tagBadgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              actionButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
              viewProjectDetailsButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
              cancelActionButtonClassName="bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 border-red-500 dark:border-red-600"
              dependencyItemClassName="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              dependentItemClassName="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              emptyItemListClassName="text-slate-600 dark:text-slate-400"
              traceAlgorithmButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
              traceAlgorithmActiveButtonClassName="bg-sky-500 dark:bg-sky-600 text-white hover:bg-sky-600 dark:hover:bg-sky-700 border-sky-500 dark:border-sky-600"
              traceableProjectItemClassName="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 justify-between"
              traceableProjectSelectedItemClassName="bg-sky-500/10 dark:bg-sky-600/10 text-slate-900 dark:text-slate-100"
            />
          ),
          'composite-project': (element) => (
            <NxGraphCompositeProjectNodePanelContent
              element={element}
              sectionHeadingClassName="text-slate-900 dark:text-slate-100"
              sectionTextClassName="text-slate-700 dark:text-slate-300"
              actionButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
              cancelActionButtonClassName="bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 border-red-500 dark:border-red-600"
              confirmActionButtonClassName="bg-sky-500 dark:bg-sky-600 text-white hover:bg-sky-600 dark:hover:bg-sky-700 border-sky-500 dark:border-sky-600"
              multiselectContainerClassName="text-slate-700 dark:text-slate-300"
              multiselectFilterInputClassName="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:border-sky-500 dark:focus:border-sky-400"
              multiselectEmptyStateClassName="text-slate-600 dark:text-slate-400"
              multiselectListItemClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
              multiselectCheckboxClassName="border-slate-300 dark:border-slate-600 accent-sky-500"
              multiselectLabelClassName="text-slate-700 dark:text-slate-300"
              multiselectSectionHeaderClassName="text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
            />
          ),
        }}
      </NxGraphElementPanel>
    </div>
  );
}
