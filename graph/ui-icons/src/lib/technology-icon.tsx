import { Framework, frameworkIcons } from './framework-icons';

export interface TechnologyIconProps {
  technology?: string;
  showTooltip?: boolean;
}

export function TechnologyIcon({
  technology,
  showTooltip,
}: TechnologyIconProps) {
  if (!technology) {
    return null;
  }
  const image = frameworkIcons[technology as Framework]?.image;

  return (
    <div
      className={`h-4 w-4 ${
        frameworkIcons[technology as Framework]?.isAdaptiveIcon
          ? 'adpative-icon'
          : ''
      } ${
        !image
          ? 'flex items-center justify-center rounded bg-slate-800 text-sm text-slate-50 dark:bg-slate-50 dark:text-slate-800'
          : ''
      }`}
      data-tooltip={showTooltip ? technology : null}
    >
      {image ?? technology[0]}
    </div>
  );
}
