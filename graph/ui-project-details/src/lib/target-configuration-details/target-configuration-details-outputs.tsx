import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';

import { TooltipTriggerText } from './tooltip-trigger-text';
import { CopyToClipboard } from './copy-to-clipboard';
import { TargetConfigurationProperty } from './target-configuration-property';
import { SourceInfo } from './source-info';
import { selectSourceInfo } from './target-configuration-details.util';

export interface TargetConfigurationDetailsOutputsProps {
  outputs: string[] | undefined;
  sourceMap: Record<string, string[]>;
  targetName: string;
  handleCopyClick: (text: string) => void;
}

export function TargetConfigurationDetailsOutputs({
  outputs,
  sourceMap,
  targetName,
  handleCopyClick,
}: TargetConfigurationDetailsOutputsProps) {
  if (!outputs) {
    return null;
  }
  if (outputs.length === 0) {
    return <span>no outputs</span>;
  }
  return (
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
        <span className="hidden group-hover:inline ml-2 mb-1">
          <CopyToClipboard
            onCopy={() =>
              handleCopyClick(`"outputs": ${JSON.stringify(outputs)}`)
            }
          />
        </span>
      </h4>
      <ul className="list-disc pl-5 mb-4">
        {outputs.map((output, index) => {
          const sourceInfo = selectSourceInfo(
            sourceMap,
            `targets.${targetName}.outputs`
          );
          return (
            <li
              className="group/line overflow-hidden whitespace-nowrap"
              key={`output-${index}`}
            >
              <TargetConfigurationProperty data={output}>
                {sourceInfo && (
                  <span className="opacity-0 flex shrink-1 min-w-0 group-hover/line:opacity-100 transition-opacity duration-150 ease-in-out inline pl-4">
                    <SourceInfo
                      data={sourceInfo}
                      propertyKey={`targets.${targetName}.outputs`}
                    />
                  </span>
                )}
              </TargetConfigurationProperty>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
