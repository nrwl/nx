import { Tooltip } from '@nx/graph/ui-tooltips';
import { JSX, ReactNode } from 'react';
import { TooltipTriggerText } from './tooltip-trigger-text';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface TargetConfigurationPropertyTextProps {
  content: ReactNode;
  disabled?: boolean;
  disabledTooltip?: ReactNode;
}

export function TargetConfigurationPropertyText({
  content,
  disabled,
  disabledTooltip,
}: TargetConfigurationPropertyTextProps): JSX.Element | null {
  return (
    <>
      <span className={disabled ? 'opacity-50' : ''}>{content}</span>
      {disabledTooltip && (
        <Tooltip openAction="hover" content={disabledTooltip}>
          <span className="pl-2 font-medium">
            <TooltipTriggerText>
              <QuestionMarkCircleIcon className="inline h-4 w-4" />
            </TooltipTriggerText>
          </span>
        </Tooltip>
      )}
    </>
  );
}
