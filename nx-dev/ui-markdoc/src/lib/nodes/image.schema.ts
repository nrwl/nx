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
  },
  transform(node: Node, config: Config): RenderableTreeNodes {
    const attributes = node.transformAttributes(config);
    const children = node.transformChildren(config);
    const src = transformImagePath(documentFilePath)(attributes['src']);
    const alt = attributes['alt'];

    return new Tag(this.render, { className: 'not-prose my-8 text-center' }, [
      new Tag('img', { src, alt, loading: 'lazy', className: 'mx-auto !my-0' }),
      new Tag(
        'figcaption',
        { className: 'mt-2 text-sm text-slate-600 dark:text-slate-400' },
        [alt]
      ),
    ]);
  },
});
