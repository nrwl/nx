import React from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import autolinkHeadings from 'rehype-autolink-headings';
import slug from 'rehype-slug';
import highlight from 'rehype-highlight/light';
import { transformLinkPath } from './renderers/transform-link-path';
import { transformImagePath } from './renderers/transform-image-path';
import { renderIframes } from './renderers/render-iframe';

export interface ContentProps {
  data: string;
  flavor: string;
  version: string;
}

export function Content(props: ContentProps) {
  return (
    <div className="min-w-0 flex-auto px-4 sm:px-6 xl:px-8 pt-10 pb-24 lg:pb-16">
      <ReactMarkdown
        remarkPlugins={[gfm]}
        rehypePlugins={[
          slug,
          autolinkHeadings,
          renderIframes,
          [
            highlight,
            {
              languages: {
                bash: require('highlight.js/lib/languages/bash'),
                console: require('highlight.js/lib/languages/markdown'), // TODO: clean from documentation's markdown
                css: require('highlight.js/lib/languages/css'),
                handlebars: require('highlight.js/lib/languages/handlebars'),
                groovy: require('highlight.js/lib/languages/groovy'),
                html: require('highlight.js/lib/languages/xml'),
                javascript: require('highlight.js/lib/languages/javascript'),
                json: require('highlight.js/lib/languages/json'),
                jsonc: require('highlight.js/lib/languages/json'), // TODO: clean from documentation's markdown
                text: require('highlight.js/lib/languages/markdown'),
                txt: require('highlight.js/lib/languages/markdown'), // TODO: clean from documentation's markdown
                typescript: require('highlight.js/lib/languages/typescript'),
                typescriptx: require('highlight.js/lib/languages/typescript'), // TODO: clean from documentation's markdown
                tsx: require('highlight.js/lib/languages/typescript'), // TODO: clean from documentation's markdown
                shell: require('highlight.js/lib/languages/shell'),
                yaml: require('highlight.js/lib/languages/yaml'),
              },
              plainText: ['treeview'],
            },
          ],
        ]}
        children={props.data}
        transformLinkUri={transformLinkPath({
          flavor: props.flavor,
          version: props.version,
        })}
        transformImageUri={transformImagePath(props.version)}
        className="prose max-w-none"
      />
    </div>
  );
}

export default Content;
