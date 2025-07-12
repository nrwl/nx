'use client';
import { forwardRef, ReactElement, ReactNode, useRef } from 'react';
import { cx } from '@nx/nx-dev-ui-primitives';
import { AnimatedCurvedBeam } from '@nx/nx-dev-ui-animations';
import {
  ClockIcon,
  FunnelIcon,
  ServerStackIcon,
  UserPlusIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

const Card = forwardRef<
  HTMLDivElement,
  {
    className?: string;
    children?: ReactNode;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }
>(({ className, children, onMouseEnter, onMouseLeave }, ref) => {
  return (
    <div
      ref={ref}
      className={cx(
        'rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800/40 dark:bg-slate-800/60',
        className
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export function CiBottleneckAnimation(): ReactElement {
  const aiAgent = useRef<HTMLDivElement>(null);
  const betterTools = useRef<HTMLDivElement>(null);
  const ciBottleneck = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const growingTeams = useRef<HTMLDivElement>(null);
  const shipSlower = useRef<HTMLDivElement>(null);

  return (
    <div
      className="relative flex h-full w-full overflow-hidden"
      ref={containerRef}
    >
      <div className="grid w-full grid-cols-1 items-center justify-center gap-6 sm:grid-cols-3 sm:gap-24">
        <div className="relative space-y-2 sm:space-y-12">
          <div className="flex flex-col items-center">
            <Card
              ref={aiAgent}
              className="border-green-400/60 bg-green-400/40 dark:border-green-800/60 dark:bg-green-800/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100">
                  <ServerStackIcon
                    aria-hidden="true"
                    className="size-5 shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-mono text-xs leading-tight">AI Agents</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
          <div className="flex flex-col items-center">
            <Card
              ref={growingTeams}
              className="border-green-400/60 bg-green-400/40 dark:border-green-800/60 dark:bg-green-800/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100">
                  <UserPlusIcon
                    aria-hidden="true"
                    className="size-5 shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-mono text-xs leading-tight">
                      Growing Teams
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
          <div className="flex flex-col items-center">
            <Card
              ref={betterTools}
              className="border-green-400/60 bg-green-400/40 dark:border-green-800/60 dark:bg-green-800/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100">
                  <WrenchScrewdriverIcon
                    aria-hidden="true"
                    className="size-5 shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-mono text-xs leading-tight">
                      Better Tools
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
        <div className="relative space-y-12">
          <div className="flex flex-col items-center">
            <Card
              ref={ciBottleneck}
              className="relative bg-white dark:border-slate-800/60 dark:bg-slate-950"
            >
              <span className="absolute -bottom-8 right-0 hidden items-center gap-x-1.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-200 sm:inline-flex dark:bg-slate-950 dark:ring-slate-800/60">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400/80 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-orange-500/80" />
                </span>
                Queue increasing
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100">
                  <FunnelIcon aria-hidden="true" className="size-5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-mono text-xs leading-tight">
                      CI Bottleneck
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
        <div className="relative space-y-2 sm:space-y-12">
          <div className="flex flex-col items-center">
            <Card
              ref={shipSlower}
              className="border-red-400/60 bg-red-400/40 dark:border-red-800/60 dark:bg-red-800/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-slate-900 dark:text-slate-100">
                  <ClockIcon aria-hidden="true" className="size-5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-mono text-xs leading-tight">
                      App Release
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <div className="hidden sm:block">
        <AnimatedCurvedBeam
          containerRef={containerRef}
          fromRef={aiAgent}
          toRef={ciBottleneck}
          curvature={15}
          startXOffset={26}
          endYOffset={0}
          bidirectional={false}
          duration={4}
          className="-z-10"
        />
        <AnimatedCurvedBeam
          containerRef={containerRef}
          fromRef={growingTeams}
          toRef={ciBottleneck}
          curvature={0}
          startXOffset={14}
          endYOffset={0}
          bidirectional={false}
          duration={6}
          className="-z-10"
        />
        <AnimatedCurvedBeam
          containerRef={containerRef}
          fromRef={betterTools}
          toRef={ciBottleneck}
          curvature={-46}
          startXOffset={26}
          endYOffset={0}
          bidirectional={false}
          duration={6}
          className="-z-10"
        />
        <AnimatedCurvedBeam
          containerRef={containerRef}
          fromRef={ciBottleneck}
          toRef={shipSlower}
          curvature={0}
          startXOffset={14}
          endYOffset={0}
          bidirectional={false}
          duration={20}
          delay={1}
          beamFrequency={5}
          className="-z-10"
        />
      </div>
    </div>
  );
}
