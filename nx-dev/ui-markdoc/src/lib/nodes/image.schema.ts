import { Config, Node, RenderableTreeNodes, Schema } from '@markdoc/markdoc';
import { transformImagePath } from './helpers/transform-image-path';
import markdoc from '@markdoc/markdoc';
const { Tag } = markdoc;

export const getImageSchema = (documentFilePath: string): Schema => ({
  render: 'img',
  attributes: {
    src: { type: 'String', required: true },
    alt: { type: 'String', required: true },
  },
  transform(node: Node, config: Config): RenderableTreeNodes {
    const attributes = node.transformAttributes(config);
    const children = node.transformChildren(config);
    const src = transformImagePath(documentFilePath)(attributes['src']);

    return new Tag(
      this.render,
      { ...attributes, src, loading: 'lazy' },
      children
    );
  },
});
