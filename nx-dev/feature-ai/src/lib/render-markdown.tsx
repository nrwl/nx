import markdoc from '@markdoc/markdoc';
import React, { ReactNode } from 'react';

const { parse, renderers, Tokenizer, transform } = markdoc;

const tokenizer = new Tokenizer({ allowComments: true });

export function renderAiMarkdown(content: string): ReactNode {
  const tokens = tokenizer.tokenize(content);
  const ast = parse(tokens);
  const tree = transform(ast, {});
  return renderers.react(tree, React);
}
