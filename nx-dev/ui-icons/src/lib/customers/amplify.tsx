import { FC, SVGProps } from 'react';

/**
 * Use `#FF9900` for a colored version.
 */
export const AmplifyIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    role="img"
    viewBox="0 0 24 14"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    {...props}
  >
    <title>AWS Amplify</title>
    <path d="M5.223 17.905h6.76l1.731 3.047H0l4.815-8.344 2.018-3.494 1.733 3.002zm2.52-10.371L9.408 4.65l9.415 16.301h-3.334zm2.59-4.486h3.33L24 20.952h-3.334z" />
  </svg>
);
