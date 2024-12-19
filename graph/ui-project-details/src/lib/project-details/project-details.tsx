/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
// nx-ignore-next-line
import { GraphError } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { EyeIcon } from '@heroicons/react/24/outline';
import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { twMerge } from 'tailwind-merge';
import { TagList } from '../tag-list/tag-list';
import { OwnersList } from '../owners-list/owners-list';
import { TargetConfigurationGroupList } from '../target-configuration-details-group-list/target-configuration-details-group-list';
import { TooltipTriggerText } from '../target-configuration-details/tooltip-trigger-text';
import { TargetTechnologies } from '../target-technologies/target-technologies';

export interface ProjectDetailsProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  errors?: GraphError[];
  variant?: 'default' | 'compact';
  connectedToCloud?: boolean;
  disabledTaskSyncGenerators?: string[];
  onViewInProjectGraph?: (data: { projectName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onNxConnect?: () => void;
  viewInProjectGraphPosition?: 'top' | 'bottom';
}

const typeToProjectType = {
  app: 'Application',
  lib: 'Library',
  e2e: 'E2E',
};

export const ProjectDetails = ({
  project,
  sourceMap,
  variant,
  onViewInProjectGraph,
  onViewInTaskGraph,
  onRunTarget,
  onNxConnect,
  viewInProjectGraphPosition = 'top',
  connectedToCloud,
  disabledTaskSyncGenerators,
}: ProjectDetailsProps) => {
  const projectData = project.data;
  const isCompact = variant === 'compact';

  const technologies = [
    ...new Set(
      [
        ...(projectData.metadata?.technologies ?? []),
        ...Object.values(projectData.targets ?? {})
          .map((target) => target?.metadata?.technologies)
          .flat(),
      ].filter(Boolean)
    ),
  ] as string[];

  return (
    <>
      <header
        className={twMerge(
          `border-b border-slate-900/10 dark:border-slate-300/10`,
          isCompact ? 'mb-2' : 'mb-4'
        )}
      >
        <div
          className={twMerge(
            `flex flex-wrap items-center justify-between`,
            isCompact ? `gap-1` : `mb-4 gap-2`
          )}
        >
          <div className="flex items-center gap-2">
            <h1
              className={twMerge(
                `dark:text-slate-100`,
                isCompact ? `text-2xl` : `text-4xl`
              )}
            >
              {project.name}
            </h1>
            <TargetTechnologies
              technologies={technologies}
              showTooltip={true}
              className="h-6 w-6"
            />
          </div>
          {onViewInProjectGraph && viewInProjectGraphPosition === 'top' && (
            <ViewInProjectGraphButton
              onClick={() =>
                onViewInProjectGraph({ projectName: project.name })
              }
            />
          )}
        </div>
        <div className="flex flex-wrap justify-between py-2">
          <div className="min-w-0">
            {projectData.metadata?.description ? (
              <p className="mb-2 text-sm capitalize text-gray-500 dark:text-slate-400">
                {projectData.metadata?.description}
              </p>
            ) : null}
            {projectData.metadata?.owners &&
            Object.keys(projectData.metadata?.owners).length ? (
              <OwnersList
                className="mb-2"
                owners={Object.keys(projectData.metadata?.owners)}
              />
            ) : null}
            {projectData.tags && projectData.tags.length ? (
              <TagList className="mb-2" tags={projectData.tags} />
            ) : null}
            {projectData.root ? (
              <p className="mb-2">
                <span className="font-medium">Root:</span>
                <span className="font-mono"> {projectData.root.trim()}</span>
              </p>
            ) : null}
            {projectData.projectType ?? typeToProjectType[project.type] ? (
              <p className="mb-2">
                <span className="font-medium">Type:</span>
                <span className="ml-2 font-mono capitalize">
                  {projectData.projectType ?? typeToProjectType[project.type]}
                </span>
              </p>
            ) : null}
          </div>
          <div className="self-end">
            {onViewInProjectGraph &&
              viewInProjectGraphPosition === 'bottom' && (
                <ViewInProjectGraphButton
                  onClick={() =>
                    onViewInProjectGraph({ projectName: project.name })
                  }
                />
              )}
          </div>
        </div>
      </header>
      <div>
        <h2 className={isCompact ? `mb-3 text-lg` : `mb-4 text-xl`}>
          <Tooltip
            openAction="hover"
            content={(<PropertyInfoTooltip type="targets" />) as any}
          >
            <span className="text-slate-800 dark:text-slate-200">
              <TooltipTriggerText>Targets</TooltipTriggerText>
            </span>
          </Tooltip>
        </h2>

        <TargetConfigurationGroupList
          className="w-full"
          project={project}
          sourceMap={sourceMap}
          variant={variant}
          onRunTarget={onRunTarget}
          onViewInTaskGraph={onViewInTaskGraph}
          connectedToCloud={connectedToCloud}
          disabledTaskSyncGenerators={disabledTaskSyncGenerators}
          onNxConnect={onNxConnect}
        />
      </div>
    </>
  );
};

export default ProjectDetails;

function ViewInProjectGraphButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-base text-slate-600 ring-2 ring-inset ring-slate-400/40 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-800/60"
      onClick={() => onClick()}
    >
      <EyeIcon className="h-5 w-5 "></EyeIcon>
      <span>View In Graph</span>
    </button>
  );
}
