import { FC, SVGProps } from 'react';

/**
 * Use `#000000` for a colored version.
 */
export const CursorIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    {...props}
  >
    <title>Cursor</title>
    <path d="M11.925 24l10.425-6-10.425-6L1.5 18l10.425 6z" fillOpacity=".5" />
    <path d="M22.35 18V6L11.925 0v12l10.425 6z" fillOpacity=".5" />
    <path d="M11.925 0L1.5 6v12l10.425-6V0z" fillOpacity=".5" />
    <path d="M22.35 6L11.925 24V12L22.35 6z" fillOpacity=".4" />
    <path d="M22.35 6l-10.425 6L1.5 6h20.85z" />
  </svg>
);
