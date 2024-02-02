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

  const docsUrlSlug: string | undefined = plugin.startsWith('@nx/')
    ? plugin.replace('@nx/', '').split('/')[0]
    : undefined;

  const tooltipContent = (
    <>
      <p className="flex grow items-center gap-2">
        <span className="font-bold">{isTarget ? 'Created' : 'Set'} by:</span>
        <span className="inline-flex grow justify-between items-center">
          {docsUrlSlug ? (
            <ExternalLink
              text={plugin}
              href={`https://nx.dev/nx-api/${docsUrlSlug}`}
            />
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
    <div className="text-sm text-slate-700 dark:text-slate-400 max-w-md sm:max-w-full">
      <div
        className={twMerge(
          `flex flex-col font-mono py-2`,
          showLink ? 'border-b border-slate-200 dark:border-slate-700/60' : ''
        )}
      >
        {tooltipContent}
      </div>
      {showLink && (
        <div className="flex py-2">
          <p className={`flex flex-col gap-1`}>
            <ExternalLink
              text="Learn more about how projects are configured"
              href="https://nx.dev/concepts/inferred-tasks"
            />
          </p>
        </div>
      )}
    </div>
  );
}
