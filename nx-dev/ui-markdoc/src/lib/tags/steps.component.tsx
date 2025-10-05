'use client';
import cx from 'classnames';
import React, { ReactNode } from 'react';

export type StepsProps = { children: ReactNode };

export function Steps({ children }: StepsProps) {
  const steps = React.Children.toArray(children);
  const stepsCount = steps.length;

  return (
    <div className="relative">
      {steps.map((step, index) => (
        <div key={index} className="relative flex pb-8 last:pb-0">
          {/* Vertical line connecting steps */}
          {index < stepsCount - 1 && (
            <div
              className="absolute left-5 top-10 h-full w-0.5 bg-slate-200 dark:bg-slate-700"
              aria-hidden="true"
            />
          )}

          {/* Step number circle */}
          <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white dark:bg-sky-500">
            <span className="text-sm font-semibold">{index + 1}</span>
          </div>

          {/* Step content */}
          <div className="ml-6 flex-1">{step}</div>
        </div>
      ))}
    </div>
  );
}

export type StepProps = {
  title?: string;
  children: ReactNode;
};

export function Step({ title, children }: StepProps) {
  const passPropsToChildren = (children: ReactNode) => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child) && typeof child.type !== 'string') {
        return React.cloneElement(child, { isWithinStep: true });
      }
      return child;
    });
  };

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      {title && (
        <h3 className="mt-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
      )}
      {passPropsToChildren(children)}
    </div>
  );
}
