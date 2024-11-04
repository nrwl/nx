/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TargetConfiguration } from '@nx/devkit';
import { JsonCodeBlock } from '@nx/graph-internal/ui-code-block';
import { ExpandedTargetsContext } from '@nx/graph/shared';
import { CopyToClipboardButton } from '@nx/graph/ui-components';
import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Pill } from '../pill';
import { ShowOptionsHelp } from '../show-all-options/show-options-help';
import { TargetConfigurationDetailsHeader } from '../target-configuration-details-header/target-configuration-details-header';
import { TargetExecutor } from '../target-executor/target-executor';
import { TargetExecutorTitle } from '../target-executor/target-executor-title';
import { getTargetExecutorSourceMapKey } from '../target-source-info/get-target-executor-source-map-key';
import { TargetSourceInfo } from '../target-source-info/target-source-info';
import { getDisplayHeaderFromTargetConfiguration } from '../utils/get-display-header-from-target-configuration';
import { getTaskSyncGenerators } from '../utils/sync-generators';
import { FadingCollapsible } from './fading-collapsible';
import { TargetConfigurationProperty } from './target-configuration-property';
import { TooltipTriggerText } from './tooltip-trigger-text';

interface TargetConfigurationDetailsProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
  connectedToCloud?: boolean;
  disabledTaskSyncGenerators?: string[];
  variant?: 'default' | 'compact';
  onCollapse?: (targetName: string) => void;
  onExpand?: (targetName: string) => void;
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  onNxConnect?: () => void;
  collapsable: boolean;
}

export default function TargetConfigurationDetails({
  variant,
  projectName,
  targetName,
  targetConfiguration,
  sourceMap,
  connectedToCloud,
  disabledTaskSyncGenerators,
  onViewInTaskGraph,
  onRunTarget,
  onNxConnect,
  collapsable,
}: TargetConfigurationDetailsProps) {
  const isCompact = variant === 'compact';
  const [collapsed, setCollapsed] = useState(true);
  const { expandedTargets, toggleTarget } = useContext(ExpandedTargetsContext);

  const handleCollapseToggle = useCallback(() => {
    if (toggleTarget) {
      toggleTarget(targetName);
    }
  }, [toggleTarget, targetName]);

  useEffect(() => {
    if (!collapsable) {
      setCollapsed(false);
      return;
    }
    if (expandedTargets?.includes(targetName)) {
      setCollapsed(false);
    } else {
      setCollapsed(true);
    }
  }, [expandedTargets, targetName, collapsable]);

  const { link, options, script, ...displayHeader } =
    getDisplayHeaderFromTargetConfiguration(targetConfiguration);
  const configurations = targetConfiguration.configurations;

  const shouldRenderOptions: boolean =
    options &&
    (typeof options === 'object' ? Object.keys(options).length > 0 : true);

  const shouldRenderConfigurations =
    configurations &&
    (typeof configurations === 'object'
      ? Object.keys(configurations).length
      : true);

  const { enabledSyncGenerators, disabledSyncGenerators } =
    getTaskSyncGenerators(targetConfiguration, disabledTaskSyncGenerators);

  return (
    <div className="relative rounded-md border border-slate-200 dark:border-slate-700/60">
      <TargetConfigurationDetailsHeader
        isCollasped={collapsed}
        toggleCollapse={handleCollapseToggle}
        collapsable={collapsable}
        isCompact={isCompact}
        targetConfiguration={targetConfiguration}
        projectName={projectName}
        targetName={targetName}
        connectedToCloud={connectedToCloud}
        sourceMap={sourceMap}
        onRunTarget={onRunTarget}
        onViewInTaskGraph={onViewInTaskGraph}
        onNxConnect={onNxConnect}
      />
      {/* body */}
      {!collapsed && (
        <div className="p-4 text-base">
          {targetConfiguration.metadata?.description && (
            <div className="group mb-4">
              <h4 className="mb-4">
                <span className="font-medium">Description</span>
                <span className="mb-1 ml-2 hidden group-hover:inline">
                  <CopyToClipboardButton
                    text={`"metadata": ${JSON.stringify({
                      description: targetConfiguration.metadata?.description,
                    })}`}
                    tooltipText="Copy Description"
                  />
                </span>
              </h4>
              <p className="pl-5">
                {targetConfiguration.metadata?.description}
              </p>
            </div>
          )}

          <div className="group mb-4">
            <h4 className="mb-4">
              <TargetExecutorTitle {...displayHeader} />
            </h4>
            <p className="pl-5 font-mono">
              <TargetExecutor {...displayHeader} link={link}>
                <TargetSourceInfo
                  className="pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100"
                  propertyKey={`targets.${targetName}.${getTargetExecutorSourceMapKey(
                    targetConfiguration
                  )}`}
                  sourceMap={sourceMap}
                />
              </TargetExecutor>
            </p>
          </div>

          {script && (
            <div className="group mb-4">
              <h4 className="mb-4">
                <TargetExecutorTitle script={script} />
              </h4>
              <p className="pl-5 font-mono">
                <TargetExecutor script={script} link={link}>
                  <TargetSourceInfo
                    className="pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100"
                    propertyKey={`targets.${targetName}.options.script`}
                    sourceMap={sourceMap}
                  />
                </TargetExecutor>
              </p>
            </div>
          )}

          {shouldRenderOptions || targetConfiguration.metadata?.help ? (
            <>
              <h4 className="mb-4">
                <Tooltip
                  openAction="hover"
                  content={(<PropertyInfoTooltip type="options" />) as any}
                >
                  <span className="font-medium">
                    <TooltipTriggerText>Options</TooltipTriggerText>
                  </span>
                </Tooltip>
              </h4>
              {shouldRenderOptions ? (
                <div className="mb-4">
                  <FadingCollapsible>
                    <JsonCodeBlock
                      data={options}
                      copyTooltipText="Copy Options"
                      renderSource={(propertyName: string) => (
                        <TargetSourceInfo
                          className="flex min-w-0 pl-4"
                          propertyKey={`targets.${targetName}.options.${propertyName}`}
                          sourceMap={sourceMap}
                        />
                      )}
                    />
                  </FadingCollapsible>
                </div>
              ) : null}
              {targetConfiguration.metadata?.help && (
                <div className="mb-4">
                  <ShowOptionsHelp
                    targetConfiguration={targetConfiguration}
                    projectName={projectName}
                    targetName={targetName}
                  />
                </div>
              )}
            </>
          ) : null}

          {targetConfiguration.inputs && (
            <div className="group">
              <h4 className="mb-4">
                <Tooltip
                  openAction="hover"
                  content={(<PropertyInfoTooltip type="inputs" />) as any}
                >
                  <span className="font-medium">
                    <TooltipTriggerText>Inputs</TooltipTriggerText>
                  </span>
                </Tooltip>
                <span className="mb-1 ml-2 hidden group-hover:inline">
                  <CopyToClipboardButton
                    text={`"inputs": ${JSON.stringify(
                      targetConfiguration.inputs
                    )}`}
                    tooltipText="Copy Inputs"
                  />
                </span>
              </h4>
              <ul className="mb-4 list-disc pl-5">
                {targetConfiguration.inputs.map((input, idx) => (
                  <li
                    className="group/line overflow-hidden whitespace-nowrap"
                    key={`input-${idx}`}
                  >
                    <TargetConfigurationProperty data={input}>
                      <TargetSourceInfo
                        className="min-w-0 flex-1 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100"
                        propertyKey={`targets.${targetName}.inputs`}
                        sourceMap={sourceMap}
                      />
                    </TargetConfigurationProperty>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {targetConfiguration.outputs && (
            <div className="group">
              <h4 className="mb-4">
                <Tooltip
                  openAction="hover"
                  content={(<PropertyInfoTooltip type="outputs" />) as any}
                >
                  <span className="font-medium">
                    <TooltipTriggerText>Outputs</TooltipTriggerText>
                  </span>
                </Tooltip>
                <span className="mb-1 ml-2 hidden group-hover:inline">
                  <CopyToClipboardButton
                    text={`"outputs": ${JSON.stringify(
                      targetConfiguration.outputs
                    )}`}
                    tooltipText="Copy Outputs"
                  />
                </span>
              </h4>
              <ul className="mb-4 list-disc pl-5">
                {targetConfiguration.outputs?.map((output, idx) => (
                  <li
                    className="group/line overflow-hidden whitespace-nowrap"
                    key={`output-${idx}`}
                  >
                    <TargetConfigurationProperty data={output}>
                      <TargetSourceInfo
                        className="min-w-0 flex-1 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100"
                        propertyKey={`targets.${targetName}.outputs`}
                        sourceMap={sourceMap}
                      />
                    </TargetConfigurationProperty>
                  </li>
                )) ?? <span>no outputs</span>}
              </ul>
            </div>
          )}
          {targetConfiguration.dependsOn && (
            <div className="group">
              <h4 className="mb-4">
                <Tooltip
                  openAction="hover"
                  content={(<PropertyInfoTooltip type="dependsOn" />) as any}
                >
                  <span className="font-medium">
                    <TooltipTriggerText>Depends On</TooltipTriggerText>
                  </span>
                </Tooltip>
                <span className="mb-1 ml-2 hidden group-hover:inline">
                  <CopyToClipboardButton
                    text={`"dependsOn": ${JSON.stringify(
                      targetConfiguration.dependsOn
                    )}`}
                    tooltipText="Copy Depends On"
                  />
                </span>
              </h4>
              <ul className="mb-4 list-disc pl-5">
                {targetConfiguration.dependsOn.map((dep, idx) => (
                  <li
                    className="group/line overflow-hidden whitespace-nowrap"
                    key={`dependsOn-${idx}`}
                  >
                    <TargetConfigurationProperty data={dep}>
                      <TargetSourceInfo
                        className="min-w-0 flex-1 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100"
                        propertyKey={`targets.${targetName}.dependsOn`}
                        sourceMap={sourceMap}
                      />
                    </TargetConfigurationProperty>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {shouldRenderConfigurations ? (
            <>
              <h4 className="mb-4 py-2">
                <Tooltip
                  openAction="hover"
                  content={
                    (<PropertyInfoTooltip type="configurations" />) as any
                  }
                >
                  <span className="font-medium">
                    <TooltipTriggerText>Configurations</TooltipTriggerText>
                  </span>
                </Tooltip>{' '}
                {targetConfiguration.defaultConfiguration && (
                  <span className="ml-3 cursor-help">
                    <Pill
                      tooltip="Default Configuration"
                      text={targetConfiguration.defaultConfiguration}
                      color="yellow"
                    />
                  </span>
                )}
              </h4>
              <FadingCollapsible>
                <JsonCodeBlock
                  data={targetConfiguration.configurations}
                  copyTooltipText="Copy Configurations"
                  renderSource={(propertyName: string) => (
                    <TargetSourceInfo
                      className="flex min-w-0 pl-4"
                      propertyKey={`targets.${targetName}.configurations.${propertyName}`}
                      sourceMap={sourceMap}
                    />
                  )}
                />
              </FadingCollapsible>
            </>
          ) : null}

          {targetConfiguration.parallelism === false ? (
            <div className="group mb-4">
              <h4 className="mb-4">
                <Tooltip
                  openAction="hover"
                  content={(<PropertyInfoTooltip type="parallelism" />) as any}
                >
                  <span className="font-medium">
                    <TooltipTriggerText>Parallelism</TooltipTriggerText>
                  </span>
                </Tooltip>
              </h4>
              <div className="group/line overflow-hidden whitespace-nowrap pl-5">
                <TargetConfigurationProperty data={{ parallelism: false }}>
                  <TargetSourceInfo
                    className="min-w-0 flex-1 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100"
                    propertyKey={`targets.${targetName}.parallelism`}
                    sourceMap={sourceMap}
                  />
                </TargetConfigurationProperty>
              </div>
            </div>
          ) : null}

          {enabledSyncGenerators.length > 0 && (
            <div className="group">
              <h4 className="mb-4">
                <Tooltip
                  openAction="hover"
                  content={
                    (<PropertyInfoTooltip type="syncGenerators" />) as any
                  }
                >
                  <span className="font-medium">
                    <TooltipTriggerText>Sync Generators</TooltipTriggerText>
                  </span>
                </Tooltip>
              </h4>
              <ul className="mb-4 list-disc pl-5">
                {enabledSyncGenerators.map((generator, idx) => (
                  <li
                    className="group/line overflow-hidden whitespace-nowrap"
                    key={`syncGenerators-${idx}`}
                  >
                    <TargetConfigurationProperty data={generator}>
                      <TargetSourceInfo
                        className="min-w-0 flex-1 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100"
                        propertyKey={`targets.${targetName}.syncGenerators`}
                        sourceMap={sourceMap}
                      />
                    </TargetConfigurationProperty>
                  </li>
                ))}
                {disabledSyncGenerators.length > 0 &&
                  disabledSyncGenerators.map((generator, idx) => (
                    <li
                      className="group/line overflow-hidden whitespace-nowrap"
                      key={`syncGenerators-${idx}`}
                    >
                      <TargetConfigurationProperty
                        data={generator}
                        disabled={true}
                        disabledTooltip={
                          <p className="max-w-sm whitespace-pre-wrap py-2 font-mono text-sm normal-case text-slate-700 dark:text-slate-400">
                            The Sync Generator is disabled in the{' '}
                            <code className="font-bold italic">
                              sync.disabledTaskSyncGenerators
                            </code>{' '}
                            property in the{' '}
                            <code className="font-bold italic">nx.json</code>{' '}
                            file.
                          </p>
                        }
                      >
                        <TargetSourceInfo
                          className="min-w-0 flex-1 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100"
                          propertyKey={`targets.${targetName}.syncGenerators`}
                          sourceMap={sourceMap}
                        />
                      </TargetConfigurationProperty>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
