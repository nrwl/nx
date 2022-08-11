import { DocumentData } from '@nrwl/nx-dev/models-document';
import { renderMarkdown } from '@nrwl/nx-dev/ui-markdoc';

export interface ContentProps {
  document: DocumentData;
}

export function Content(props: ContentProps): JSX.Element {
  return (
    <div className="min-w-0 flex-auto px-4 pt-8 pb-24 sm:px-6 lg:pb-16 xl:px-8">
      <div className="prose max-w-none">{renderMarkdown(props.document)}</div>
    </div>
  );
}
