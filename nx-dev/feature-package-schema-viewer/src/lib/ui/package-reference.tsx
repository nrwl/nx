import {
  ChipIcon,
  CogIcon,
  InformationCircleIcon,
} from '@heroicons/react/solid';
import { SchemaMetadata } from '@nrwl/nx-dev/models-package';
import { renderMarkdown } from '@nrwl/nx-dev/ui-markdoc';
import Link from 'next/link';
import React from 'react';
import { Heading2 } from './headings';

export function PackageReference({
  executors,
  generators,
  name,
}: {
  executors: SchemaMetadata[];
  generators: SchemaMetadata[];
  name: string;
}): JSX.Element {
  return (
    <>
      <Heading2 title="Package reference" />

      <p className="mb-16">
        Here is a list of all the executors and generators available from this
        package.
      </p>

      <Heading2 title={'Executors'} />
      <ul className="divide-y divide-gray-200">
        {executors.map((executor) => (
          <SchemaListItem
            schema={executor}
            packageName={name}
            type="executors"
          />
        ))}
        {executors.length === 0 && <EmptyList type="executor" />}
      </ul>

      <div className="h-12">{/* SPACER */}</div>
      <Heading2 title={'Generators'} />
      <ul className="divide-y divide-gray-200">
        {generators.map((generator) => (
          <SchemaListItem
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
      className="focus-within:ring-blue-nx-base relative flex px-2 py-4 transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-gray-50"
    >
      {type === 'executors' ? (
        <ChipIcon
          className="h-8 w-8 flex-shrink-0 rounded-full text-gray-300"
          role="img"
        />
      ) : (
        <CogIcon
          className="h-8 w-8 flex-shrink-0 rounded-full text-gray-300"
          role="img"
        />
      )}
      <div className="ml-3">
        <p className="text-sm font-medium text-gray-900">
          <Link href={`/packages/${packageName}/${type}/${schema.name}`}>
            <a className="focus:outline-none">
              <span className="absolute inset-0" aria-hidden="true"></span>
              {schema.name}
            </a>
          </Link>
        </p>
        <div className="prose-sm">
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

function EmptyList({ type }: { type: 'executor' | 'generator' }): JSX.Element {
  return (
    <li className="focus-within:ring-blue-nx-base relative flex px-2 py-4 transition focus-within:ring-2 focus-within:ring-offset-2 hover:bg-gray-50">
      <InformationCircleIcon
        className="h-8 w-8 flex-shrink-0 rounded-full text-gray-300"
        role="img"
      />
      <div className="ml-3">
        <p className="text-sm font-medium text-gray-900">
          <Link href="https://github.com/nrwl/nx/discussions">
            <a className="focus:outline-none" rel="noreferrer" target="_blank">
              <span className="absolute inset-0" aria-hidden="true"></span>
              No {type} available for this package yet!
            </a>
          </Link>
        </p>
        <div className="prose-sm">
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
