import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { CopyToClipboard } from '../copy-to-clipboard/copy-to-clipboard';
import { TooltipTriggerText } from '../target-configuration-details/tooltip-trigger-text';

export function TargetExecutorTitle({
  commands,
  command,
  script,
  handleCopyClick,
}: {
  handleCopyClick: (copyText: string) => void;
  commands?: string[];
  command?: string;
  script?: string;
}) {
  if (commands && commands.length) {
    return (
      <span className="font-medium">
        Commands
        <span className="mb-1 ml-2 hidden group-hover:inline">
          <CopyToClipboard
            onCopy={() =>
              handleCopyClick(
                `"commands": [${commands.map((c) => `"${c}"`).join(', ')}]`
              )
            }
          />
        </span>
      </span>
    );
  }
  if (command) {
    return (
      <span className="font-medium">
        Command
        <span className="mb-1 ml-2 hidden group-hover:inline">
          <CopyToClipboard
            onCopy={() => handleCopyClick(`"command": "${command}"`)}
          />
        </span>
      </span>
    );
  }
  if (script) {
    return (
      <span className="font-medium">
        Script
        <span className="mb-1 ml-2 hidden group-hover:inline">
          <CopyToClipboard onCopy={() => handleCopyClick(script)} />
        </span>
      </span>
    );
  }
  return (
    <Tooltip
      openAction="hover"
      content={(<PropertyInfoTooltip type="executors" />) as any}
    >
      <span className="font-medium">
        <TooltipTriggerText>Executor</TooltipTriggerText>
      </span>
    </Tooltip>
  );
}
