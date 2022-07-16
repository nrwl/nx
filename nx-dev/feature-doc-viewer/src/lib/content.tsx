import { DocumentData } from '@nrwl/nx-dev/models-document';
import { renderMarkdown } from '@nrwl/nx-dev/ui-markdoc';

export interface ContentProps {
  document: DocumentData;
}

export function Content(props: ContentProps): JSX.Element {
  return (
    <div className="min-w-0 flex-auto pb-24 lg:pb-16">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        {renderMarkdown(props.document)}
      </div>
    </div>
  );
}
