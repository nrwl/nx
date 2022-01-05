import React from 'react';
import ReactMarkdown from 'react-markdown';
import autolinkHeadings from 'rehype-autolink-headings';
import gfm from 'remark-gfm';
import slug from 'rehype-slug';
import { DocumentData } from '@nrwl/nx-dev/data-access-documents';
import { sendCustomEvent } from '@nrwl/nx-dev/feature-analytics';
import { transformImagePath } from './renderers/transform-image-path';
import { renderIframes } from './renderers/render-iframe';
import { CodeBlock } from './code-block';

export interface ContentProps {
  document: DocumentData;
}

interface ComponentsConfig {
  readonly code: { callback: (command: string) => void };
}

const components: any = (config: ComponentsConfig) => ({
  img({ node, alt, src, ...props }) {
    return <img src={src} alt={alt} loading="lazy" />;
  },
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
    <div className="min-w-0 flex-auto px-4 sm:px-6 xl:px-8 pt-8 pb-24 lg:pb-16">
      <ReactMarkdown
        remarkPlugins={[gfm]}
        rehypePlugins={[
          slug,
          [
            autolinkHeadings,
            {
              behavior: 'append',
              content: createAnchorContent,
            },
          ],
          renderIframes,
        ]}
        children={props.document.content}
        transformImageUri={transformImagePath({
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

function createAnchorContent(node: any) {
  node.properties.className = ['group'];
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      xmlns: 'http://www.w3.org/2000/svg',
      className: [
        'inline',
        'ml-2',
        'mb-1',
        `h-5`,
        `w-5`,
        'opacity-0',
        'group-hover:opacity-100',
      ],
      fill: 'none',
      viewBox: '0 0 24 24',
      stroke: 'currentColor',
    },
    children: [
      {
        type: 'element',
        tagName: 'path',
        properties: {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '2',
          d: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
        },
        children: [],
      },
    ],
  };
}

export default Content;
