import { FC, SVGProps } from 'react';

export const SquareDottedPattern: FC<SVGProps<SVGSVGElement>> = (props) => (
  <>
    <svg
      className="absolute left-full top-12 translate-x-32 transform"
      width={404}
      height={384}
      fill="none"
      viewBox="0 0 404 384"
      {...props}
    >
      <defs>
        <pattern
          id="74b3fd99-0a6f-4271-bef2-e80eeafdf357"
          x={0}
          y={0}
          width={20}
          height={20}
          patternUnits="userSpaceOnUse"
        >
          <rect
            x={0}
            y={0}
            width={4}
            height={4}
            className="text-slate-200 dark:text-slate-800"
            fill="currentColor"
          />
        </pattern>
      </defs>
      <rect
        width={404}
        height={384}
        fill="url(#74b3fd99-0a6f-4271-bef2-e80eeafdf357)"
      />
    </svg>
    <svg
      className="absolute right-full top-1/2 -translate-x-32 -translate-y-1/2 transform"
      width={404}
      height={384}
      fill="none"
      viewBox="0 0 404 384"
    >
      <defs>
        <pattern
          id="f210dbf6-a58d-4871-961e-36d5016a0f49"
          x={0}
          y={0}
          width={20}
          height={20}
          patternUnits="userSpaceOnUse"
        >
          <rect
            x={0}
            y={0}
            width={4}
            height={4}
            className="text-slate-200 dark:text-slate-800"
            fill="currentColor"
          />
        </pattern>
      </defs>
      <rect
        width={404}
        height={384}
        fill="url(#f210dbf6-a58d-4871-961e-36d5016a0f49)"
      />
    </svg>
    <svg
      className="absolute bottom-12 left-full translate-x-32 transform"
      width={404}
      height={384}
      fill="none"
      viewBox="0 0 404 384"
    >
      <defs>
        <pattern
          id="d3eb07ae-5182-43e6-857d-35c643af9034"
          x={0}
          y={0}
          width={20}
          height={20}
          patternUnits="userSpaceOnUse"
        >
          <rect
            x={0}
            y={0}
            width={4}
            height={4}
            className="text-slate-200 dark:text-slate-800"
            fill="currentColor"
          />
        </pattern>
      </defs>
      <rect
        width={404}
        height={384}
        fill="url(#d3eb07ae-5182-43e6-857d-35c643af9034)"
      />
    </svg>
  </>
);
