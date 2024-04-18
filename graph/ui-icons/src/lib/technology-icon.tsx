import { Framework, frameworkIcons } from './framework-icons';

export interface TechnologyIconProps {
  technology?: string;
  showTooltip?: boolean;
}

export function TechnologyIcon({
  technology,
  showTooltip,
}: TechnologyIconProps) {
  if (!technology || !frameworkIcons[technology as Framework]) {
    return null;
  }
  return (
    <div
      className={`h-4 w-4 ${
        frameworkIcons[technology as Framework].isAdaptiveIcon
          ? 'adpative-icon'
          : ''
      }`}
      data-tooltip={showTooltip ? technology : null}
    >
      {frameworkIcons[technology as Framework].image}
    </div>
  );
}
