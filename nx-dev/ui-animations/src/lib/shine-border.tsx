'use client';
import { cx } from '@nx/nx-dev/ui-primitives';
import { CSSProperties, ReactNode } from 'react';

type TColorProp = `#${string}` | `#${string}`[];
interface ShineBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: TColorProp;
  className?: string;
  children: ReactNode;
}

/**
 * Shines a border around a container element.
 *
 * @param borderRadius - The radius of the border corners in pixels. Defaults to 8.
 * @param borderWidth - The width of the border in pixels. Defaults to 1.
 * @param duration - The duration of the shine animation in seconds. Defaults to 14.
 * @param color - The color of the shine. Can be a single color (string) or an array of colors. Defaults to '#fff'.
 * @param className - Additional CSS classes to apply to the container element.
 * @param children - The content to display inside the container element.
 *
 * @return The container element with a shining border.
 */
export function ShineBorder({
  borderRadius = 8,
  borderWidth = 1,
  duration = 14,
  color = '#fff',
  className,
  children,
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          '--border-radius': `${borderRadius}px`,
        } as CSSProperties
      }
      className={cx(
        'relative grid min-h-[60px] w-fit min-w-[300px] place-items-center rounded-[--border-radius] bg-white p-3 text-black dark:bg-black dark:text-white',
        className
      )}
    >
      <div
        style={
          {
            '--border-width': `${borderWidth}px`,
            '--border-radius': `${borderRadius}px`,
            '--border-radius-child': `${borderRadius * 0.2}px`,
            '--shine-pulse-duration': `${duration}s`,
            '--mask-linear-gradient': `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
            '--background-radial-gradient': `radial-gradient(transparent,transparent, ${
              !(color instanceof Array) ? color : color.join(',')
            },transparent,transparent)`,
          } as CSSProperties
        }
        className={`before:bg-shine-size before:absolute before:inset-[0] before:aspect-square before:h-full before:w-full before:rounded-[--border-radius] before:p-[--border-width] before:will-change-[background-position] before:content-[""] before:![-webkit-mask-composite:xor] before:[background-image:var(--background-radial-gradient)] before:[background-size:300%_300%] before:![mask-composite:exclude] before:[mask:var(--mask-linear-gradient)] motion-safe:before:animate-[shine-pulse_var(--shine-pulse-duration)_infinite_linear]`}
      ></div>
      <div className={'z-[1] h-full w-full rounded-[--border-radius-child]'}>
        {children}
      </div>
    </div>
  );
}
