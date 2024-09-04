import {
  Config,
  Node,
  RenderableTreeNodes,
  Schema,
  Tag,
} from '@markdoc/markdoc';
import { transformImagePath } from './helpers/transform-image-path';

export const getImageSchema = (documentFilePath: string): Schema => ({
  render: 'figure',
  attributes: {
    src: { type: 'String', required: true },
    alt: { type: 'String', required: true },
    title: { type: 'String', required: false },
  },
  transform(node: Node, config: Config): RenderableTreeNodes {
    const attributes = node.transformAttributes(config);
    const children = node.transformChildren(config);
    const src = transformImagePath(documentFilePath)(attributes['src']);

    return new Tag(this.render, { ...attributes, src, loading: 'lazy' }, [
      new Tag('img', {
        src,
        alt: attributes['alt'],
        loading: 'lazy',
      }),
      attributes['title']
        ? new Tag('figcaption', { class: 'italic text-center' }, [
            attributes['title'],
          ])
        : null,
      ...children,
    ]);
  },
});
