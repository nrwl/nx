'use client';
import cx from 'classnames';
import { ReactNode, createContext, useState } from 'react';

const FlipCardContext = createContext<{
  fullDate: string;
  onClick?: () => void;
}>({
  fullDate: '',
  onClick: () => {},
});

export function FlipCard({
  isFlippable,
  isFlipped,
  day,
  fullDate,
  onFlip,
  onClick,
  children,
}: {
  isFlippable?: boolean;
  isFlipped?: boolean;
  onFlip?: (day: number, isFlipped: boolean) => void;
  day: number;
  fullDate?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <FlipCardContext.Provider value={{ fullDate: fullDate || '', onClick }}>
      <span
        onClick={(event) => {
          if (isFlippable && !isFlipped) {
            onFlip && onFlip(day, true);
            event.preventDefault();
          } else {
            onClick && onClick();
          }
        }}
        className={cx(
          'perspective group block',
          isFlippable && !isFlipped ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <div
          className={cx(
            'preserve-3d relative h-full w-full content-center rounded-lg border-2 bg-white/60 shadow-sm transition duration-200 focus-within:ring-offset-2 dark:bg-slate-800/90',
            isFlippable && isFlipped
              ? 'my-rotate-y-180 bg-white dark:bg-slate-800'
              : '',
            isFlippable
              ? isFlipped
                ? 'border-blue-400 dark:border-slate-800'
                : 'border-blue-400 hover:[transform:rotateY(10deg)] dark:border-slate-800'
              : 'border-1 border-slate-300 dark:border-slate-800'
          )}
        >
          <FlipCardFront>{fullDate}</FlipCardFront>
          {children}
        </div>
      </span>
    </FlipCardContext.Provider>
  );
}

export function FlipCardFront({ children }: { children: ReactNode }) {
  return (
    <div className="backface-hidden absolute flex h-full w-full flex-col items-center justify-center px-2 text-center text-3xl font-bold">
      {children}
    </div>
  );
}

export function FlipCardBack({ children }: { children: ReactNode }) {
  return (
    <FlipCardContext.Consumer>
      {() => (
        <div className="my-rotate-y-180 backface-hidden h-full w-full overflow-hidden rounded-md bg-white text-3xl text-slate-900 dark:bg-slate-800 dark:text-slate-100">
          <div className="p-4 text-sm sm:text-sm md:text-sm lg:text-lg">
            {children}
          </div>
        </div>
      )}
    </FlipCardContext.Consumer>
  );
}
