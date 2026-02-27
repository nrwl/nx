'use client';

import type {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';
import { useCallback, useEffect, useMemo } from 'react';
import { ElementData, RenderTheme } from '@nx/graph';
import {
  NxGraphProjectGraphProvider,
  useProjectGraphContext,
} from '@nx/graph/projects';
import { affectedNodeStyles, useThemeSync } from './resolve-theme';
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
  showAffectedWithNodes?: boolean;
}

export function NxDevProjectGraph(props: NxDevProjectGraphProps) {
  return (
    <NxGraphProjectGraphProvider
      renderPlatform="nx-dev"
      styles={[affectedNodeStyles]}
    >
      <NxDevProjectGraphInner {...props} />
    </NxGraphProjectGraphProvider>
  );
}

function NxDevProjectGraphInner({
  projects,
  dependencies = {},
  affectedProjects = [],
  theme = 'system',
  composite = false,
  enableContextMenu = false,
  showAffectedWithNodes = false,
}: NxDevProjectGraphProps) {
  const graphContext = useProjectGraphContext();

  const { containerRef, orchestrator, sendRendererConfigEvent, send } =
    graphContext;

  const eventBus = useMemo(
    () => (enableContextMenu ? orchestrator : null),
    [orchestrator, enableContextMenu]
  );

  const [element] = useElementPanel<
    ElementData.ProjectNode | ElementData.CompositeProjectNode
  >(eventBus);

  const handleThemeChange = useCallback(
    (resolvedTheme: RenderTheme) => {
      sendRendererConfigEvent({
        type: 'themeChange',
        theme: resolvedTheme,
      });
    },
    [sendRendererConfigEvent]
  );

  useThemeSync(theme, handleThemeChange);

  useEffect(() => {
    if (!orchestrator) return;

    send({ type: 'initGraph', projects, dependencies, affectedProjects });

    send({
      type: 'updateRendererConfig',
      updater: (config) => ({
        mode: composite ? 'composite' : 'individual',
        autoExpand: composite ? config.autoExpand : 0,
        showMode: showAffectedWithNodes
          ? 'all'
          : affectedProjects.length
            ? 'affected'
            : 'all',
      }),
    });

    send({ type: 'showAll' });
    // make sure the graph sized to fix into the box
    const el = orchestrator['renderer'].cy.elements();
    orchestrator['renderer'].cy.fit(el, 1).center().resize();
    // other values are static from the docs and we don't need to update for them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orchestrator, send]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="flex h-full w-full cursor-pointer"
      ></div>

      <NxGraphElementPanel
        element={element}
        panelContainerClassName="border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        panelHeaderClassName="border-zinc-300 dark:border-zinc-700"
        panelContentContainerClassName="divide-zinc-300 dark:divide-zinc-700"
        header={{
          project: (element, { open, close }) => (
            <NxGraphProjectNodePanelHeader
              element={element}
              open={open}
              close={close}
              badgeClassName="bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 uppercase"
              elementNameClassName="text-zinc-900 dark:text-zinc-100"
              closeButtonClassName="hover:bg-zinc-100 dark:hover:bg-zinc-700"
            />
          ),
          'composite-project': (element, { open, close }) => (
            <NxGraphCompositeProjectNodePanelHeader
              element={element}
              open={open}
              close={close}
              badgeClassName="bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 uppercase"
              elementNameClassName="text-zinc-900 dark:text-zinc-100"
              closeButtonClassName="hover:bg-zinc-100 dark:hover:bg-zinc-700"
            />
          ),
        }}
      >
        {{
          project: (element) => (
            <NxGraphProjectNodePanelContent
              element={element}
              sectionHeadingClassName="text-zinc-900 dark:text-zinc-100"
              sectionTextClassName="text-zinc-700 dark:text-zinc-300"
              tagBadgeClassName="bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600"
              actionButtonClassName="bg-zinc-100/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 border-zinc-300 dark:border-zinc-600"
              cancelActionButtonClassName="bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 border-red-500 dark:border-red-600"
              dependencyItemClassName="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              dependentItemClassName="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              emptyItemListClassName="text-zinc-600 dark:text-zinc-400"
              traceAlgorithmButtonClassName="bg-zinc-100/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 border-zinc-300 dark:border-zinc-600"
              traceAlgorithmActiveButtonClassName="bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 border-blue-500 dark:border-blue-600"
              traceableProjectItemClassName="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 justify-between"
              traceableProjectSelectedItemClassName="bg-blue-500/10 dark:bg-blue-600/10 text-zinc-900 dark:text-zinc-100"
            />
          ),
          'composite-project': (element) => (
            <NxGraphCompositeProjectNodePanelContent
              element={element}
              sectionHeadingClassName="text-zinc-900 dark:text-zinc-100"
              sectionTextClassName="text-zinc-700 dark:text-zinc-300"
              actionButtonClassName="bg-zinc-100/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 border-zinc-300 dark:border-zinc-600"
              cancelActionButtonClassName="bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 border-red-500 dark:border-red-600"
              confirmActionButtonClassName="bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 border-blue-500 dark:border-blue-600"
              multiselectContainerClassName="text-zinc-700 dark:text-zinc-300"
              multiselectFilterInputClassName="bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 focus:border-blue-500 dark:focus:border-blue-400"
              multiselectEmptyStateClassName="text-zinc-600 dark:text-zinc-400"
              multiselectListItemClassName="hover:bg-zinc-100 dark:hover:bg-zinc-700"
              multiselectCheckboxClassName="border-zinc-300 dark:border-zinc-600 accent-blue-500"
              multiselectLabelClassName="text-zinc-700 dark:text-zinc-300"
              multiselectSectionHeaderClassName="text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
            />
          ),
        }}
      </NxGraphElementPanel>
    </div>
  );
}
