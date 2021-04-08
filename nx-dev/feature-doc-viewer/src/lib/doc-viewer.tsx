export interface DocumentationFeatureDocViewerProps {
  content: string;
}

export function DocViewer(props: DocumentationFeatureDocViewerProps) {
  return (
    <div
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: props.content }}
    />
  );
}
