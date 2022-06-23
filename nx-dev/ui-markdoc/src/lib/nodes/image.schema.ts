import {
  Config,
  Node,
  RenderableTreeNodes,
  Schema,
  Tag,
} from '@markdoc/markdoc';
import { DocumentData } from '@nrwl/nx-dev/models-document';
import { transformImagePath } from './helpers/transform-image-path';

export const getImageSchema = (document: DocumentData): Schema => ({
  render: 'img',
  attributes: {
    src: { type: 'String', required: true },
    alt: { type: 'String', required: true },
  },
  transform(node: Node, config: Config): RenderableTreeNodes {
    const attributes = node.transformAttributes(config);
    const children = node.transformChildren(config);
    const src = transformImagePath(document)(attributes['src']);

    return new Tag(
      this.render,
      // `h${node.attributes['level']}`,
      { ...attributes, src, loading: 'lazy' },
      children
    );
  },
});
