import { forwardRef } from 'react';
import { Pill } from '../pill';

export interface TargetConfigurationGroupContainerProps {
  targetGroupName: string;
  targetsNumber: number;
  children: React.ReactNode;
}

export const TargetConfigurationGroupContainer = forwardRef(
  (
    {
      targetGroupName,
      targetsNumber,
      children,
    }: TargetConfigurationGroupContainerProps,
    ref: React.Ref<HTMLDivElement>
  ) => {
    return (
      <div ref={ref} className="mb-4">
        <header className="p-2 text-lg">
          {targetGroupName}{' '}
          <Pill
            text={
              targetsNumber.toString() +
              (targetsNumber === 1 ? ' target' : ' targets')
            }
          />
        </header>
        <section className="rounded-md border border-slate-200 p-2 dark:border-slate-700/60">
          {children}
        </section>
      </div>
    );
  }
);
