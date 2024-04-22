// eslint-disable-next-line @typescript-eslint/no-unused-vars

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';

import { EyeIcon } from '@heroicons/react/24/outline';
import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { TooltipTriggerText } from '../target-configuration-details/tooltip-trigger-text';
import { twMerge } from 'tailwind-merge';
import { Pill } from '../pill';
import { TargetConfigurationDetailsList } from '../target-configuration-details-list/target-configuration-details-list';
import { TargetTechnologies } from '../target-technologies/target-technologies';

export interface ProjectDetailsProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  variant?: 'default' | 'compact';
  onViewInProjectGraph?: (data: { projectName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
}

export const ProjectDetails = ({
  project,
  sourceMap,
  variant,
  onViewInProjectGraph,
  onViewInTaskGraph,
  onRunTarget,
}: ProjectDetailsProps) => {
  const projectData = project.data;
  const isCompact = variant === 'compact';

  const displayType =
    projectData.projectType &&
    projectData.projectType?.charAt(0)?.toUpperCase() +
      projectData.projectType?.slice(1);

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
            `flex items-center justify-between`,
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
            />
          </div>
          <span>
            {onViewInProjectGraph ? (
              <button
                className="inline-flex cursor-pointer items-center gap-2 rounded-md py-1 px-2 text-base text-slate-600 ring-2 ring-inset ring-slate-400/40 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-800/60"
                onClick={() =>
                  onViewInProjectGraph({ projectName: project.name })
                }
              >
                <EyeIcon className="h-5 w-5 "></EyeIcon>
                <span>View In Graph</span>
              </button>
            ) : null}{' '}
          </span>
        </div>
        <div className="py-2 ">
          {projectData.tags && projectData.tags.length ? (
            <p>
              <span className="inline-block w-10 font-medium">Tags:</span>
              {projectData.tags?.map((tag) => (
                <span className="ml-2 font-mono">
                  <Pill text={tag} />
                </span>
              ))}
            </p>
          ) : null}
          <p>
            <span className="inline-block w-10 font-medium">Root:</span>
            <span className="font-mono"> {projectData.root}</span>
          </p>
          {displayType ? (
            <p>
              <span className="inline-block w-10 font-medium">Type:</span>
              <span className="font-mono"> {displayType}</span>
            </p>
          ) : null}
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

        <TargetConfigurationDetailsList
          className="w-full"
          project={project}
          sourceMap={sourceMap}
          variant={variant}
          onRunTarget={onRunTarget}
          onViewInTaskGraph={onViewInTaskGraph}
        />
      </div>
    </>
  );
};

export default ProjectDetails;
