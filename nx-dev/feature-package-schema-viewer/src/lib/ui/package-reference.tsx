import {
  CogIcon,
  CpuChipIcon,
  DocumentIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { DocumentMetadata } from '@nx/nx-dev/models-document';
import { FileMetadata } from '@nx/nx-dev/models-package';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import Link from 'next/link';
import React from 'react';

export function DocumentList({
  documents,
}: {
  documents: DocumentMetadata[];
}): JSX.Element {
  return (
    <>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {!!documents.length ? (
          documents.map((guide) => (
            <DocumentListItem key={guide.id} document={guide} />
          ))
        ) : (
          <EmptyList type="document" />
        )}
      </ul>
    </>
  );
}

function DocumentListItem({
  document,
}: {
  document: DocumentMetadata;
}): JSX.Element {
  return (
    <li
      key={document.name}
      className="relative flex px-2 py-2 transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-slate-50 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800/60"
    >
      <div className="flex-shrink-0 self-start rounded-lg border-slate-200 bg-slate-100 p-2 dark:border-slate-600 dark:bg-slate-700">
        <DocumentIcon className="h-5 w-5" role="img" />
      </div>
      <div className="ml-3 py-2">
        <p className="text-sm font-bold">
          <Link href={document.path} className="focus:outline-none">
            <span className="absolute inset-0" aria-hidden="true"></span>
            {document.name}
          </Link>
        </p>
      </div>
    </li>
  );
}

export function SchemaList({
  files,
  type,
}: {
  files: FileMetadata[];
  type: 'executor' | 'generator';
}): JSX.Element {
  return (
    <>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {!!files.length ? (
          files.map((schema) => (
            <SchemaListItem key={schema.name} file={schema} />
          ))
        ) : (
          <EmptyList type={type} />
        )}
      </ul>
    </>
  );
}

function SchemaListItem({ file }: { file: FileMetadata }): JSX.Element {
  return (
    <li
      key={file.name}
      className="relative flex px-2 py-2 transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-slate-50 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800/60"
    >
      <div className="flex-shrink-0 self-start rounded-lg border-slate-200 bg-slate-100 p-2 dark:border-slate-600 dark:bg-slate-700">
        {file.type === 'executor' ? (
          <CpuChipIcon className="h-5 w-5 " role="img" />
        ) : (
          <CogIcon className="h-5 w-5" role="img" />
        )}
      </div>
      <div className="ml-3 py-2">
        <p className="text-sm font-bold">
          <Link href={file.path} className="focus:outline-none">
            <span className="absolute inset-0" aria-hidden="true"></span>
            {file.name}
          </Link>

          {file.hidden && (
            <span className="ml-4 inline-flex rounded-md border border-red-100 bg-red-50 px-2 py-1 text-xs font-medium uppercase text-red-600 dark:border-red-900 dark:bg-red-900/30 dark:text-red-400">
              Internal
            </span>
          )}
        </p>
        <div className="prose prose-slate dark:prose-invert prose-sm">
          {
            renderMarkdown(file.description, {
              filePath: '',
            }).node
          }
        </div>
      </div>
    </li>
  );
}

function EmptyList({
  type,
}: {
  type: 'executor' | 'generator' | 'document';
}): JSX.Element {
  return (
    <li className="relative flex px-2 py-2 transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-slate-50 dark:focus-within:ring-sky-500 dark:hover:bg-slate-800/60">
      <div className="flex-shrink-0 self-start rounded-lg border-slate-200 bg-slate-100 p-2 dark:border-slate-600 dark:bg-slate-700">
        <InformationCircleIcon
          className="h-5 w-5 flex-shrink-0 rounded-md border-slate-100 bg-slate-50 dark:bg-slate-800 dark:bg-slate-700"
          role="img"
        />
      </div>
      <div className="ml-3 py-2">
        <p className="text-sm font-medium">
          <Link
            href="https://github.com/nrwl/nx/discussions"
            className="focus:outline-none"
            rel="noreferrer"
            target="_blank"
          >
            <span className="absolute inset-0" aria-hidden="true"></span>No{' '}
            {type} available for this package yet!
          </Link>
        </p>
        <div className="prose prose-slate dark:prose-invert prose-sm">
          <a
            href="https://github.com/nrwl/nx/discussions"
            target="_blank"
            rel="noreferrer"
          >
            Please be sure to check the Nx roadmap on GitHub, we are probably
            working on what you are looking for.
          </a>
        </div>
      </div>
    </li>
  );
}
