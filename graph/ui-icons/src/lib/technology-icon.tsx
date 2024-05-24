import { HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';
import { Framework, frameworkIcons } from './framework-icons';
import { MonochromaticTechnologyIconsMap } from './technology-icons-map-monochromatic';

export interface TechnologyIconProps extends HTMLProps<HTMLDivElement> {
  technology?: string;
  showTooltip?: boolean;
  monochromatic?: boolean;
}

export function TechnologyIcon({
  technology,
  showTooltip,
  monochromatic,
  ...props
}: TechnologyIconProps) {
  if (!technology) {
    return null;
  }
  if (monochromatic) {
    return (
      <TechnologyIconMonochromatic
        {...props}
        technology={technology}
        showTooltip={showTooltip}
      />
    );
  }
  return (
    <TechnologyIconColor
      {...props}
      technology={technology}
      showTooltip={showTooltip}
    />
  );
}

function UnknownTechnologyIcon({
  technology,
  showTooltip,
  ...props
}: TechnologyIconProps) {
  if (!technology) {
    return null;
  }
  return (
    <div
      {...props}
      className={twMerge(
        'h-4 w-4',
        'flex items-center justify-center rounded border border-slate-400 text-sm text-slate-400',
        props.className
      )}
      data-tooltip={showTooltip ? technology : null}
    >
      {technology[0]}
    </div>
  );
}

export function TechnologyIconMonochromatic({
  technology,
  showTooltip,
  ...props
}: TechnologyIconProps) {
  if (!technology) {
    return null;
  }
  const Icon = MonochromaticTechnologyIconsMap[technology as any]?.icon;

  if (!Icon) {
    return (
      <UnknownTechnologyIcon
        {...props}
        technology={technology}
        showTooltip={showTooltip}
      />
    );
  }

  return (
    <div
      {...props}
      className={twMerge('text-slate-400', 'h-4 w-4', props.className)}
      data-tooltip={showTooltip ? technology : null}
    >
      <Icon />
    </div>
  );
}

export function TechnologyIconColor({
  technology,
  showTooltip,
  ...props
}: TechnologyIconProps) {
  if (!technology) {
    return null;
  }
  const image = frameworkIcons[technology as Framework]?.image;

  if (!image) {
    return (
      <UnknownTechnologyIcon
        {...props}
        technology={technology}
        showTooltip={showTooltip}
      />
    );
  }

  return (
    <div
      {...props}
      className={twMerge(
        'h-4 w-4',
        frameworkIcons[technology as Framework]?.isAdaptiveIcon
          ? 'adaptive-icon'
          : '',
        props.className
      )}
      data-tooltip={showTooltip ? technology : null}
    >
      {image}
    </div>
  );
}
