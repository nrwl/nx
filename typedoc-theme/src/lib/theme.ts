import MarkdownTheme from 'typedoc-plugin-markdown/dist/theme';
import { ReflectionKind } from 'typedoc/dist/lib/models';

/**
 * The MarkdownTheme is based on TypeDoc's DefaultTheme @see https://github.com/TypeStrong/typedoc/blob/master/src/lib/output/themes/DefaultTheme.ts.
 * - html specific components are removed from the renderer
 * - markdown specefic components have been added
 */

export default class NrwlMarkdownTheme extends MarkdownTheme {
  constructor(renderer, basePath) {
    super(renderer, basePath);

    const relativeURL = MarkdownTheme.HANDLEBARS.helpers.relativeURL;
    NrwlMarkdownTheme.HANDLEBARS.helpers.relativeURL = function (url: string) {
      return relativeURL(url.replace('.md', ''));
    };
  }

  get mappings() {
    return [
      {
        kind: [ReflectionKind.Module],
        isLeaf: true,
        directory: '.',
        template: 'reflection.hbs',
      },
    ];
  }

  /**
   * Returns the full url of a given mapping and reflection
   * @param mapping
   * @param reflection
   */
  toUrl(mapping, reflection) {
    return (
      (mapping.directory === '.' ? '' : mapping.directory + '/') +
      this.getUrl(reflection) +
      '.md'
    );
  }
}
