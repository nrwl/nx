import React from 'react';
import ReactMarkdown from 'react-markdown';
import autolinkHeadings from 'rehype-autolink-headings';
import gfm from 'remark-gfm';
import slug from 'rehype-slug';

import { transformLinkPath } from './renderers/transform-link-path';
import { transformImagePath } from './renderers/transform-image-path';
import { renderIframes } from './renderers/render-iframe';
import { CodeBlock } from './code-block';

export interface ContentProps {
  data: string;
  flavor: string;
  version: string;
}

const components: any = {
  code({ node, inline, className, children, ...props }) {
    const language = /language-(\w+)/.exec(className || '')?.[1];
    return !inline && language ? (
      <CodeBlock
        text={String(children).replace(/\n$/, '')}
        language={language}
        {...props}
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
};

export function Content(props: ContentProps) {
  return (
    <div className="min-w-0 flex-auto px-4 sm:px-6 xl:px-8 pt-10 pb-24 lg:pb-16">
      <ReactMarkdown
        remarkPlugins={[gfm]}
        rehypePlugins={[slug, autolinkHeadings, renderIframes]}
        children={props.data}
        transformLinkUri={transformLinkPath({
          flavor: props.flavor,
          version: props.version,
        })}
        transformImageUri={transformImagePath(props.version)}
        className="prose max-w-none"
        components={components}
      />
    </div>
  );
}

export default Content;
