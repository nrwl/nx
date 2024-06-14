import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { CopyToClipboardButton } from '@nx/graph/ui-components';
import { TooltipTriggerText } from '../target-configuration-details/tooltip-trigger-text';

export function TargetExecutorTitle({
  commands,
  command,
  script,
  executor,
}: {
  commands?: string[];
  command?: string;
  script?: string;
  executor?: string;
}) {
  if (commands && commands.length) {
    return (
      <span className="font-medium">
        Commands
        <span className="mb-1 ml-2 hidden group-hover:inline">
          <CopyToClipboardButton
            text={`"commands": [${commands.map((c) => `"${c}"`).join(', ')}]`}
            tooltipText="Copy Commands"
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
          <CopyToClipboardButton
            text={`"command": "${command}"`}
            tooltipText="Copy Command"
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
          <CopyToClipboardButton text={script} tooltipText="Copy Script" />
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
        <span className="mb-1 ml-2 hidden group-hover:inline">
          <CopyToClipboardButton
            text={executor ?? ''}
            tooltipText="Copy Executor"
          />
        </span>
      </span>
    </Tooltip>
  );
}
