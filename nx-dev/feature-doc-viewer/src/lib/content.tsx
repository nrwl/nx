import React from 'react';
import ReactMarkdown from 'react-markdown';
import autolinkHeadings from 'rehype-autolink-headings';
import gfm from 'remark-gfm';
import slug from 'rehype-slug';
import { DocumentData } from '@nrwl/nx-dev/data-access-documents';
import { sendCustomEvent } from '@nrwl/nx-dev/feature-analytics';
import { transformLinkPath } from './renderers/transform-link-path';
import { transformImagePath } from './renderers/transform-image-path';
import { renderIframes } from './renderers/render-iframe';
import { CodeBlock } from './code-block';

export interface ContentProps {
  document: DocumentData;
  flavor: string;
  version: string;
}

interface ComponentsConfig {
  readonly code: { callback: (command: string) => void };
}
const components: any = (config: ComponentsConfig) => ({
  code({ node, inline, className, children, ...props }) {
    const language = /language-(\w+)/.exec(className || '')?.[1];
    return !inline && language ? (
      <CodeBlock
        text={String(children).replace(/\n$/, '')}
        language={language}
        {...props}
        callback={(command) => config.code.callback(command)}
      />
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
});

export function Content(props: ContentProps) {
  return (
    <div className="min-w-0 flex-auto px-4 sm:px-6 xl:px-8 pt-10 pb-24 lg:pb-16">
      <ReactMarkdown
        remarkPlugins={[gfm]}
        rehypePlugins={[slug, autolinkHeadings, renderIframes]}
        children={props.document.content}
        transformLinkUri={transformLinkPath({
          flavor: props.flavor,
          version: props.version,
        })}
        transformImageUri={transformImagePath({
          version: props.version,
          document: props.document,
        })}
        className="prose max-w-none"
        components={components({
          code: {
            callback: () =>
              sendCustomEvent(
                'code-snippets',
                'click',
                props.document.filePath
              ),
          },
        })}
      />
    </div>
  );
}

export default Content;
