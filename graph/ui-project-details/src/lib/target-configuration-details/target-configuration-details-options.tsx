import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { TooltipTriggerText } from './tooltip-trigger-text';
import { selectSourceInfo } from './target-configuration-details.util';
import { SourceInfo } from './source-info';
import { FadingCollapsible } from './fading-collapsible';
import { JsonCodeBlock } from '@nx/graph/ui-code-block';

export interface TargetConfigurationDetailsOptionsProps {
  options: Record<string, any> | undefined;
  sourceMap: Record<string, string[]>;
  targetName: string;
  handleCopyClick: (text: string) => void;
}

export function TargetConfigurationDetailsOptions({
  options,
  sourceMap,
  targetName,
}: TargetConfigurationDetailsOptionsProps) {
  if (!options || Object.keys(options).length === 0) {
    return null;
  }

  return (
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
                <span className="pl-4 flex shrink-1 min-w-0">
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
  );
}
