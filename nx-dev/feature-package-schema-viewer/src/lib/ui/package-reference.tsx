import {
  CogIcon,
  CpuChipIcon,
  DocumentIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { MenuItem } from '@nrwl/nx-dev/models-menu';
import { SchemaMetadata } from '@nrwl/nx-dev/models-package';
import { renderMarkdown } from '@nrwl/nx-dev/ui-markdoc';
import Link from 'next/link';
import React from 'react';
import { Heading2 } from './headings';

export function PackageReference({
  executors,
  generators,
  guides,
  name,
}: {
  executors: SchemaMetadata[];
  generators: SchemaMetadata[];
  guides: MenuItem;
  name: string;
}): JSX.Element {
  return (
    <>
      <Heading2 title="Package reference" />

      <p className="mb-16">
        Here is a list of all the executors and generators available from this
        package.
      </p>

      <Heading2 title={'Guides'} />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {guides &&
          guides.itemList &&
          guides.itemList
            .filter((x) => x.id !== 'overview')
            .map((guide) => <GuideListItem key={guide.id} guide={guide} />)}
        {(!guides || (guides && guides.itemList?.length === 0)) && (
          <EmptyList type="guides" />
        )}
      </ul>

      <div className="h-12">{/* SPACER */}</div>
      <Heading2 title={'Executors'} />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {executors.map((executor) => (
          <SchemaListItem
            key={executor.name}
            schema={executor}
            packageName={name}
            type="executors"
          />
        ))}
        {executors.length === 0 && <EmptyList type="executor" />}
      </ul>

      <div className="h-12">{/* SPACER */}</div>
      <Heading2 title={'Generators'} />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {generators.map((generator) => (
          <SchemaListItem
            key={generator.name}
            schema={generator}
            packageName={name}
            type="generators"
          />
        ))}
        {generators.length === 0 && <EmptyList type="generator" />}
      </ul>
    </>
  );
}

function GuideListItem({ guide }: { guide: MenuItem }) {
  return (
    <li
      key={guide.name}
      className="focus-within:ring-blue-nx-base relative flex px-2 py-2 transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <div className="flex-shrink-0 self-start rounded-lg border-slate-200 bg-slate-100 p-2 dark:border-slate-600 dark:bg-slate-700">
        <DocumentIcon className="h-5 w-5" role="img" />
      </div>
      <div className="ml-3 py-2">
        <p className="text-sm font-bold">
          <Link href={guide.path as string}>
            <a className="focus:outline-none">
              <span className="absolute inset-0" aria-hidden="true"></span>
              {guide.name}
            </a>
          </Link>
        </p>
      </div>
    </li>
  );
}

function SchemaListItem({
  schema,
  type,
  packageName,
}: {
  schema: SchemaMetadata;
  type: 'executors' | 'generators';
  packageName: string;
}): JSX.Element {
  return (
    <li
      key={schema.name}
      className="focus-within:ring-blue-nx-base relative flex px-2 py-2 transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <div className="flex-shrink-0 self-start rounded-lg border-slate-200 bg-slate-100 p-2 dark:border-slate-600 dark:bg-slate-700">
        {type === 'executors' ? (
          <CpuChipIcon className="h-5 w-5 " role="img" />
        ) : (
          <CogIcon className="h-5 w-5" role="img" />
        )}
      </div>
      <div className="ml-3 py-2">
        <p className="text-sm font-bold">
          <Link href={`/packages/${packageName}/${type}/${schema.name}`}>
            <a className="focus:outline-none">
              <span className="absolute inset-0" aria-hidden="true"></span>
              {schema.name}
            </a>
          </Link>

          {schema.hidden && (
            <span className="ml-4 inline-flex rounded-md border border-red-100 bg-red-50 px-2 py-1 text-xs font-medium uppercase text-red-600 dark:border-red-900 dark:bg-red-900/30 dark:text-red-400">
              Internal
            </span>
          )}
        </p>
        <div className="prose prose-slate dark:prose-invert prose-sm">
          {renderMarkdown({
            content: schema.description,
            data: {},
            filePath: '',
          })}
        </div>
      </div>
    </li>
  );
}

function EmptyList({
  type,
}: {
  type: 'executor' | 'generator' | 'guides';
}): JSX.Element {
  return (
    <li className="focus-within:ring-blue-nx-base relative flex px-2 py-2 transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <div className="flex-shrink-0 self-start rounded-lg border-slate-200 bg-slate-100 p-2 dark:border-slate-600 dark:bg-slate-700">
        <InformationCircleIcon
          className="h-5 w-5 flex-shrink-0 rounded-md border-slate-100 bg-slate-50 dark:bg-slate-800 dark:bg-slate-700"
          role="img"
        />
      </div>
      <div className="ml-3 py-2">
        <p className="text-sm font-medium">
          <Link href="https://github.com/nrwl/nx/discussions">
            <a className="focus:outline-none" rel="noreferrer" target="_blank">
              <span className="absolute inset-0" aria-hidden="true"></span>
              No {type} available for this package yet!
            </a>
          </Link>
        </p>
        <div className="prose prose-slate dark:prose-invert prose-sm">
          <a
            href="https://github.com/nrwl/nx/discussions"
            target="_blank"
            rel="noreferrer"
          >
            Please be sure to check the Nx roadmap on Github, we are probably
            working on what you are looking for.
          </a>
        </div>
      </div>
    </li>
  );
}
