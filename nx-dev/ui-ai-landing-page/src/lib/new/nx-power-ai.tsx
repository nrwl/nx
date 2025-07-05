import type { FC, ReactElement, SVGProps } from 'react';
import {
  ClaudeIcon,
  GoogleGeminiIcon,
  MetaIcon,
  OpenAiIcon,
} from '@nx/nx-dev/ui-icons';
import { cx } from '@nx/nx-dev/ui-primitives';

const HexagonShape: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 22 24"
    {...props}
  >
    <path d="M8.6 1.386C9.474.88 9.911.628 10.376.53a3 3 0 0 1 1.248 0c.464.098.902.35 1.776.856l5.592 3.228c.875.505 1.312.758 1.63 1.11.281.313.494.681.623 1.081.147.452.147.957.147 1.966v6.458c0 1.01 0 1.514-.146 1.966a3 3 0 0 1-.624 1.08c-.318.353-.755.606-1.63 1.11l-5.592 3.23c-.874.504-1.312.757-1.776.855a2.997 2.997 0 0 1-1.248 0c-.465-.098-.902-.35-1.776-.856l-5.592-3.228c-.875-.505-1.312-.758-1.63-1.11a3 3 0 0 1-.623-1.081c-.147-.452-.147-.957-.147-1.966V8.77c0-1.01 0-1.514.147-1.966a3 3 0 0 1 .623-1.08c.318-.353.755-.606 1.63-1.11L8.6 1.384Z" />
  </svg>
);

export function NxPowerAi({
  className = '',
}: {
  className?: string;
}): ReactElement {
  return (
    <div className={cx('relative mx-auto w-full max-w-md p-4', className)}>
      <div className="pointer-events-none">
        <ul className="grid grid-cols-5 gap-x-2">
          {/*Row 1*/}
          <li className="invisible aspect-square" />
          <li className="relative isolate flex aspect-square h-20 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-slate-50/90 drop-shadow-sm dark:text-white/5"
            />
          </li>
          <li className="relative isolate flex aspect-square h-20 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-white/70 drop-shadow-lg dark:text-white/15"
            />
            <OpenAiIcon
              aria-hidden="true"
              className="z-10 size-8 text-black dark:text-white"
            />
          </li>
          <li className="relative isolate flex aspect-square h-20 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-slate-50/90 drop-shadow-sm dark:text-white/5"
            />
          </li>
          <li className="invisible aspect-square" />

          {/*Row 2*/}
          <li className="flex aspect-square translate-x-1/2 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-slate-50/90 drop-shadow-sm dark:text-white/5"
            />
          </li>
          <li className="relative isolate flex aspect-square h-20 translate-x-1/2 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-white/70 drop-shadow-lg dark:text-white/15"
            />
            <ClaudeIcon
              aria-hidden="true"
              className="z-10 size-8 text-[#D97757]"
            />
          </li>
          <li className="relative isolate flex aspect-square h-20 translate-x-1/2 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-white/70 drop-shadow-lg dark:text-white/15"
            />
            <GoogleGeminiIcon
              aria-hidden="true"
              className="z-10 size-8 text-[#8E75B2]"
            />
          </li>
          <li className="flex aspect-square translate-x-1/2 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-slate-50/90 drop-shadow-sm dark:text-white/5"
            />
          </li>
          <li className="invisible"></li>

          {/*Row 3*/}
          <li className="invisible" />
          <li className="relative isolate flex aspect-square h-20 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-slate-50/90 drop-shadow-sm dark:text-white/5"
            />
          </li>
          <li className="relative isolate flex aspect-square h-20 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-white/70 drop-shadow-lg dark:text-white/15"
            />
            <MetaIcon
              aria-hidden="true"
              className="z-10 size-8 text-[#0467DF]"
            />
          </li>
          <li className="relative isolate flex aspect-square h-20 items-center justify-center">
            <HexagonShape
              aria-hidden="true"
              className="absolute inset-0 z-0 text-slate-50/90 drop-shadow-sm dark:text-white/5"
            />
          </li>
          <li className="invisible" />
        </ul>
      </div>

      {/* Steps List */}
      <div className="relative mt-12 space-y-2">
        {/* Active Step */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800/40 dark:bg-slate-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex size-5 items-center justify-center rounded-full border border-white/25 bg-gradient-to-br from-slate-200 to-slate-300 dark:border-slate-900 dark:from-slate-700 dark:to-slate-800">
                <div className="size-2 rounded-full bg-white dark:bg-slate-900" />
              </div>
              <div className="flex-1">
                <p className="font-mono text-xs leading-tight text-slate-900 dark:text-slate-100">
                  Generating a fix for test "ui-profile:test:save-preferences"
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Working...
              </span>
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-orange-500" />
              </span>
            </div>
          </div>
        </div>

        {/* Completed Step */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 opacity-50 shadow-sm backdrop-blur-sm dark:border-slate-800/40 dark:bg-slate-800/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex grow items-center space-x-3">
              <div className="flex size-5 items-center justify-center rounded-full border border-white/25 bg-gradient-to-br from-slate-200 to-slate-300 dark:border-slate-900 dark:from-slate-700 dark:to-slate-800">
                <div className="size-2 rounded-full bg-white dark:bg-slate-900" />
              </div>

              <div className="w-full grow space-y-1">
                <div className="h-1 w-8 rounded-sm bg-slate-800/15 dark:bg-slate-200/35" />
                <div className="h-1 w-1/2 rounded-sm bg-slate-500/10 dark:bg-slate-400/35" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Done
              </span>
              <div className="size-1.5 rounded-full bg-green-500 shadow-sm" />
            </div>
          </div>
        </div>

        {/* Pending Step */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 opacity-40 shadow-sm backdrop-blur-sm dark:border-slate-800/40 dark:bg-slate-800/60">
          <div className="flex items-center space-x-3">
            <div className="flex size-5 items-center justify-center rounded-full border border-white/25 bg-gradient-to-br from-slate-200 to-slate-300 dark:border-slate-900 dark:from-slate-700 dark:to-slate-800">
              <div className="size-2 rounded-full bg-white dark:bg-slate-900" />
            </div>
            <div className="flex-1">
              <div className="h-1 w-16 rounded-sm bg-slate-400/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
