/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TargetConfiguration } from '@nx/devkit';

import { JsonCodeBlock } from '@nx/graph/ui-code-block';
import { useCallback, useContext, useEffect, useState } from 'react';
import { SourceInfo } from '../source-info/source-info';
import { FadingCollapsible } from './fading-collapsible';
import { TargetConfigurationProperty } from './target-configuration-property';
import { selectSourceInfo } from './target-configuration-details.util';
import { CopyToClipboard } from '../copy-to-clipboard/copy-to-clipboard';
import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { TooltipTriggerText } from './tooltip-trigger-text';
import { Pill } from '../pill';
import { TargetConfigurationDetailsHeader } from '../target-configuration-details-header/target-configuration-details-header';
import { ExpandedTargetsContext } from '@nx/graph/shared';
import { getDisplayHeaderFromTargetConfiguration } from '../utils/get-display-header-from-target-configuration';
import { TargetExecutor } from '../target-executor/target-executor';
import { TargetExecutorTitle } from '../target-executor/target-executor-title';

interface TargetConfigurationDetailsProps {
  projectName: string;
  targetName: string;
  targetConfiguration: TargetConfiguration;
  sourceMap: Record<string, string[]>;
  variant?: 'default' | 'compact';
  onCollapse?: (targetName: string) => void;
  onExpand?: (targetName: string) => void;
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  collapsable: boolean;
}

export default function TargetConfigurationDetails({
  variant,
  projectName,
  targetName,
  targetConfiguration,
  sourceMap,
  onViewInTaskGraph,
  onRunTarget,
  collapsable,
}: TargetConfigurationDetailsProps) {
  const isCompact = variant === 'compact';
  const [collapsed, setCollapsed] = useState(true);
  const { expandedTargets, toggleTarget } = useContext(ExpandedTargetsContext);

  const handleCopyClick = async (copyText: string) => {
    await window.navigator.clipboard.writeText(copyText);
  };

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

  const shouldRenderOptions =
    options &&
    (typeof options === 'object' ? Object.keys(options).length : true);

  const shouldRenderConfigurations =
    configurations &&
    (typeof configurations === 'object'
      ? Object.keys(configurations).length
      : true);

  return (
    <div className="relative overflow-hidden rounded-md border border-slate-200 dark:border-slate-700/60">
      <TargetConfigurationDetailsHeader
        isCollasped={collapsed}
        toggleCollapse={handleCollapseToggle}
        collapsable={collapsable}
        isCompact={isCompact}
        targetConfiguration={targetConfiguration}
        projectName={projectName}
        targetName={targetName}
        sourceMap={sourceMap}
        onRunTarget={onRunTarget}
        onViewInTaskGraph={onViewInTaskGraph}
      />
      {/* body */}
      {!collapsed && (
        <div className="p-4 text-base">
          <div className="group mb-4">
            <h4 className="mb-4">
              <TargetExecutorTitle
                {...displayHeader}
                handleCopyClick={handleCopyClick}
              />
            </h4>
            <p className="pl-5 font-mono">
              <TargetExecutor {...displayHeader} link={link} />
            </p>
          </div>

          {script && (
            <div className="group mb-4">
              <h4 className="mb-4">
                <TargetExecutorTitle
                  script={script}
                  handleCopyClick={handleCopyClick}
                />
              </h4>
              <p className="pl-5 font-mono">
                <TargetExecutor script={script} link={link} />
              </p>
            </div>
          )}

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
                  <CopyToClipboard
                    onCopy={() =>
                      handleCopyClick(
                        `"inputs": ${JSON.stringify(
                          targetConfiguration.inputs
                        )}`
                      )
                    }
                  />
                </span>
              </h4>
              <ul className="mb-4 list-disc pl-5">
                {targetConfiguration.inputs.map((input, idx) => {
                  const sourceInfo = selectSourceInfo(
                    sourceMap,
                    `targets.${targetName}.inputs`
                  );
                  return (
                    <li
                      className="group/line overflow-hidden whitespace-nowrap"
                      key={`input-${idx}`}
                    >
                      <TargetConfigurationProperty data={input}>
                        {sourceInfo && (
                          <span className="inline flex min-w-0 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100">
                            <SourceInfo
                              data={sourceInfo}
                              propertyKey={`targets.${targetName}.inputs`}
                            />
                          </span>
                        )}
                      </TargetConfigurationProperty>
                    </li>
                  );
                })}
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
                  <CopyToClipboard
                    onCopy={() =>
                      handleCopyClick(
                        `"outputs": ${JSON.stringify(
                          targetConfiguration.outputs
                        )}`
                      )
                    }
                  />
                </span>
              </h4>
              <ul className="mb-4 list-disc pl-5">
                {targetConfiguration.outputs?.map((output, idx) => {
                  const sourceInfo = selectSourceInfo(
                    sourceMap,
                    `targets.${targetName}.outputs`
                  );
                  return (
                    <li
                      className="group/line overflow-hidden whitespace-nowrap"
                      key={`output-${idx}`}
                    >
                      <TargetConfigurationProperty data={output}>
                        {sourceInfo && (
                          <span className="inline flex min-w-0 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100">
                            <SourceInfo
                              data={sourceInfo}
                              propertyKey={`targets.${targetName}.outputs`}
                            />
                          </span>
                        )}
                      </TargetConfigurationProperty>
                    </li>
                  );
                }) ?? <span>no outputs</span>}
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
                <span className="inline pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100">
                  <CopyToClipboard
                    onCopy={() =>
                      handleCopyClick(
                        `"dependsOn": ${JSON.stringify(
                          targetConfiguration.dependsOn
                        )}`
                      )
                    }
                  />
                </span>
              </h4>
              <ul className="mb-4 list-disc pl-5">
                {targetConfiguration.dependsOn.map((dep, idx) => {
                  const sourceInfo = selectSourceInfo(
                    sourceMap,
                    `targets.${targetName}.dependsOn`
                  );

                  return (
                    <li
                      className="group/line overflow-hidden whitespace-nowrap"
                      key={`dependsOn-${idx}`}
                    >
                      <TargetConfigurationProperty data={dep}>
                        <span className="inline flex min-w-0 pl-4 opacity-0 transition-opacity duration-150 ease-in-out group-hover/line:opacity-100">
                          {sourceInfo && (
                            <SourceInfo
                              data={sourceInfo}
                              propertyKey={`targets.${targetName}.dependsOn`}
                            />
                          )}
                        </span>
                      </TargetConfigurationProperty>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {shouldRenderOptions ? (
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
              <div className="mb-4">
                <FadingCollapsible>
                  <JsonCodeBlock
                    data={options}
                    renderSource={(propertyName: string) => {
                      const sourceInfo = selectSourceInfo(
                        sourceMap,
                        `targets.${targetName}.options.${propertyName}`
                      );
                      return sourceInfo ? (
                        <span className="flex min-w-0 pl-4">
                          <SourceInfo
                            data={sourceInfo}
                            propertyKey={`targets.${targetName}.options.${propertyName}`}
                          />
                        </span>
                      ) : null;
                    }}
                  />
                </FadingCollapsible>
              </div>
            </>
          ) : (
            ''
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
                  renderSource={(propertyName: string) => {
                    const sourceInfo = selectSourceInfo(
                      sourceMap,
                      `targets.${targetName}.configurations.${propertyName}`
                    );
                    return sourceInfo ? (
                      <span className="flex min-w-0 pl-4">
                        <SourceInfo
                          data={sourceInfo}
                          propertyKey={`targets.${targetName}.configurations.${propertyName}`}
                        />{' '}
                      </span>
                    ) : null;
                  }}
                />
              </FadingCollapsible>
            </>
          ) : (
            ''
          )}
        </div>
      )}
    </div>
  );
}
