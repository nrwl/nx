/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TargetConfiguration } from '@nx/devkit';
import { CopyToClipboardButton } from '@nx/graph/ui-components';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';

import {
  AtomizerTooltip,
  PropertyInfoTooltip,
  Tooltip,
} from '@nx/graph/ui-tooltips';
import { twMerge } from 'tailwind-merge';
import { Pill } from '../pill';
import { TargetTechnologies } from '../target-technologies/target-technologies';
import { SourceInfo } from '../source-info/source-info';
import { getDisplayHeaderFromTargetConfiguration } from '../utils/get-display-header-from-target-configuration';
import { TargetExecutor } from '../target-executor/target-executor';

export interface TargetConfigurationDetailsHeaderProps {
  isCollasped: boolean;
  toggleCollapse?: () => void;
  collapsable: boolean;
  isCompact?: boolean;
  targetConfiguration: TargetConfiguration;
  projectName: string;
  targetName: string;
  sourceMap: Record<string, string[]>;
  connectedToCloud?: boolean;
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  onNxConnect?: () => void;
}

export const TargetConfigurationDetailsHeader = ({
  isCollasped,
  toggleCollapse,
  collapsable,
  isCompact,
  targetConfiguration,
  projectName,
  targetName,
  connectedToCloud = true,
  sourceMap,
  onRunTarget,
  onViewInTaskGraph,
  onNxConnect,
}: TargetConfigurationDetailsHeaderProps) => {
  if (!collapsable) {
    // when collapsable is false, isCollasped should be false
    isCollasped = false;
  }

  const { command, commands, script, executor } =
    getDisplayHeaderFromTargetConfiguration(targetConfiguration);

  return (
    <header
      className={twMerge(
        `group hover:bg-slate-50 dark:hover:bg-slate-800/60`,
        collapsable ? 'cursor-pointer' : '',
        isCompact ? 'px-2 py-1' : 'p-2',
        !isCollasped || !collapsable
          ? 'border-b bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800'
          : ''
      )}
      onClick={collapsable ? toggleCollapse : undefined}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {collapsable &&
              (isCollasped ? (
                <ChevronDownIcon className="h-3 w-3" />
              ) : (
                <ChevronUpIcon className="h-3 w-3" />
              ))}
            <h3 className="font-medium dark:text-slate-300">{targetName}</h3>
            <TargetTechnologies
              technologies={targetConfiguration.metadata?.technologies}
              showTooltip={!isCollasped}
              className="h-4 w-4"
            />
            {isCollasped &&
              targetConfiguration?.executor !== '@nx/js:release-publish' && (
                <p className="min-w-0 flex-1 truncate text-sm text-slate-400">
                  <TargetExecutor
                    command={command}
                    commands={commands}
                    script={script}
                    executor={executor}
                    isCompact={true}
                  />
                </p>
              )}
          </div>
          <div className="flex items-center gap-2">
            {targetName === 'nx-release-publish' && (
              <Tooltip
                openAction="hover"
                strategy="fixed"
                content={(<PropertyInfoTooltip type="release" />) as any}
              >
                <span className="inline-flex">
                  <Pill text="nx release" color="grey" />
                </span>
              </Tooltip>
            )}
            {targetConfiguration.metadata?.nonAtomizedTarget && (
              <Tooltip
                openAction="hover"
                strategy="fixed"
                usePortal={true}
                content={
                  (
                    <AtomizerTooltip
                      connectedToCloud={connectedToCloud}
                      nonAtomizedTarget={
                        targetConfiguration.metadata.nonAtomizedTarget
                      }
                      onNxConnect={onNxConnect}
                    />
                  ) as any
                }
              >
                <span className="inline-flex">
                  <Pill
                    color={connectedToCloud ? 'grey' : 'yellow'}
                    text={'Atomizer'}
                  />
                </span>
              </Tooltip>
            )}
            {targetConfiguration.cache && (
              <Tooltip
                openAction="hover"
                strategy="fixed"
                content={(<PropertyInfoTooltip type="cacheable" />) as any}
              >
                <span className="inline-flex">
                  <Pill text="Cacheable" color="green" />
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CopyToClipboardButton
            text={JSON.stringify(targetConfiguration, null, 2)}
            tooltipText={!isCollasped ? 'Copy Target' : undefined}
            tooltipAlignment="right"
            className="rounded-md bg-inherit p-1 text-sm text-slate-600 ring-1 ring-inset ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60"
          />
          {onViewInTaskGraph && (
            <button
              className="rounded-md bg-inherit p-1 text-sm text-slate-600 ring-1 ring-inset ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60"
              // TODO: fix tooltip overflow in collapsed state
              data-tooltip={isCollasped ? false : 'View in Task Graph'}
              data-tooltip-align-right
              onClick={(e) => {
                if (isCollasped) {
                  return;
                }
                e.stopPropagation();
                onViewInTaskGraph({ projectName, targetName });
              }}
            >
              <EyeIcon className={`h-5 w-5 !cursor-pointer`} />
            </button>
          )}

          {onRunTarget && (
            <span
              className="rounded-md bg-inherit p-1 text-sm text-slate-600 ring-1 ring-inset ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60"
              // TODO: fix tooltip overflow in collapsed state
              data-tooltip={isCollasped ? false : 'Run Target'}
              data-tooltip-align-right
            >
              <PlayIcon
                className="h-5 w-5 !cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onRunTarget({ projectName, targetName });
                }}
              />
            </span>
          )}
        </div>
      </div>
      {!isCollasped && (
        <div className="ml-5 mt-2 text-sm">
          <div className="flex">
            <SourceInfo
              data={sourceMap[`targets.${targetName}`]}
              propertyKey={`targets.${targetName}`}
              color="text-gray-500 dark:text-slate-400"
            />
          </div>
          {targetName !== 'nx-release-publish' && (
            <div className="mt-2 text-right">
              <code className="ml-4 rounded bg-gray-100 px-2 py-1 font-mono text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                nx run {projectName}:{targetName}
              </code>
              <span>
                <CopyToClipboardButton
                  text={`nx run ${projectName}:${targetName}`}
                  tooltipText="Copy Command"
                  tooltipAlignment="right"
                />
              </span>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
