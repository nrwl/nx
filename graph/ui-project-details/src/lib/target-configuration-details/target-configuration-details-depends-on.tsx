/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TargetDependencyConfig } from '@nx/devkit';
import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';

import { TooltipTriggerText } from './tooltip-trigger-text';
import { CopyToClipboard } from './copy-to-clipboard';
import { selectSourceInfo } from './target-configuration-details.util';
import { TargetConfigurationProperty } from './target-configuration-property';
import { SourceInfo } from './source-info';

export interface TargetConfigurationDetailsDependsOnProps {
  dependsOn: (TargetDependencyConfig | string)[] | undefined;
  sourceMap: Record<string, string[]>;
  targetName: string;
  handleCopyClick: (text: string) => void;
}

export function TargetConfigurationDetailsDependsOn({
  dependsOn,
  sourceMap,
  targetName,
  handleCopyClick,
}: TargetConfigurationDetailsDependsOnProps) {
  if (!dependsOn || dependsOn.length === 0) {
    return null;
  }

  return (
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
        <span className="opacity-0 group-hover/line:opacity-100 transition-opacity duration-150 ease-in-out inline pl-4">
          <CopyToClipboard
            onCopy={() =>
              handleCopyClick(`"dependsOn": ${JSON.stringify(dependsOn)}`)
            }
          />
        </span>
      </h4>
      <ul className="list-disc pl-5 mb-4">
        {dependsOn.map((dep, idx) => {
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
                <span className="opacity-0 flex shrink-1 min-w-0 group-hover/line:opacity-100 transition-opacity duration-150 ease-in-out inline pl-4">
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
  );
}
