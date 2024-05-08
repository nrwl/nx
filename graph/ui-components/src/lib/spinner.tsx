/**
 * Spinner component from https://tailwindcss.com/docs/animation#spin
 */

import React from 'react';

export type SpinnerProps = React.SVGProps<SVGSVGElement>;

export function Spinner({ className, ...rest }: SpinnerProps) {
  return (
    <svg
      className={`${className} h-8 w-8 animate-spin`}
      viewBox="0 0 24 24"
      {...rest}
    >
      <circle
        className="opacity-10"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}
