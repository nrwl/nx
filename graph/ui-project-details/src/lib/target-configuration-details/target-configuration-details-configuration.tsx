import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { Pill } from '@nx/graph/ui-components';

import { TooltipTriggerText } from './tooltip-trigger-text';
import { FadingCollapsible } from './fading-collapsible';
import { JsonCodeBlock } from '@nx/graph/ui-code-block';
import { selectSourceInfo } from './target-configuration-details.util';
import { SourceInfo } from './source-info';

export interface TargetConfigurationDetailsConfigurationProps {
  defaultConfiguration: string | undefined;
  configurations: { [config: string]: any } | undefined;
  sourceMap: Record<string, string[]>;
  targetName: string;
}

export function TargetConfigurationDetailsConfiguration({
  defaultConfiguration,
  configurations,
  sourceMap,
  targetName,
}: TargetConfigurationDetailsConfigurationProps) {
  if (!configurations || Object.keys(configurations).length === 0) {
    return null;
  }

  return (
    <>
      <h4 className="py-2 mb-4">
        <Tooltip
          openAction="hover"
          content={(<PropertyInfoTooltip type="configurations" />) as any}
        >
          <span className="font-medium">
            <TooltipTriggerText>Configurations</TooltipTriggerText>
          </span>
        </Tooltip>{' '}
        {defaultConfiguration && (
          <span className="ml-3 cursor-help">
            <Pill
              tooltip="Default Configuration"
              text={defaultConfiguration}
              color="yellow"
            />
          </span>
        )}
      </h4>
      <FadingCollapsible>
        <JsonCodeBlock
          data={configurations}
          renderSource={(propertyName: string) => {
            const sourceInfo = selectSourceInfo(
              sourceMap,
              `targets.${targetName}.configurations.${propertyName}`
            );
            return sourceInfo ? (
              <span className="pl-4 flex shrink-1 min-w-0">
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
  );
}
