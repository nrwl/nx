import { type ReactNode } from 'react';
import { ExternalLink } from './external-link';
import { twMerge } from 'tailwind-merge';

export interface SourcemapInfoToolTipProps {
  propertyKey: string;
  plugin: string;
  file: string;
  children?: ReactNode | ReactNode[];
  showLink?: boolean;
}

export function SourcemapInfoToolTip({
  propertyKey,
  plugin,
  file,
  showLink,
}: SourcemapInfoToolTipProps) {
  // Target property key is in the form `target.${targetName}`
  // Every other property within in the target has the form `target.${targetName}.${propertyName}
  const isTarget = propertyKey.split('.').length === 2;

  const docsUrlSlug: string | undefined = plugin?.startsWith('@nx/')
    ? plugin.replace('@nx/', '').split('/')[0]
    : undefined;

  const tooltipContent = (
    <>
      <p className="flex grow items-center gap-2">
        <span className="font-bold">{isTarget ? 'Created' : 'Set'} by:</span>
        <span className="inline-flex grow items-center justify-between">
          {docsUrlSlug ? (
            <ExternalLink href={`https://nx.dev/nx-api/${docsUrlSlug}`}>
              {plugin}
            </ExternalLink>
          ) : (
            `${plugin}`
          )}
        </span>
      </p>
      <p>
        <span className="font-bold">From:</span> {file}
      </p>
    </>
  );

  return (
    <div className="max-w-md text-sm text-slate-700 sm:max-w-full dark:text-slate-400">
      <div
        className={twMerge(
          `flex flex-col py-2 font-mono`,
          showLink ? 'border-b border-slate-200 dark:border-slate-700/60' : ''
        )}
      >
        {tooltipContent}
      </div>
      {showLink && (
        <div className="flex py-2">
          <p className={`flex flex-col gap-1`}>
            <ExternalLink href="https://nx.dev/concepts/inferred-tasks">
              Learn more about how projects are configured
            </ExternalLink>
          </p>
        </div>
      )}
    </div>
  );
}
