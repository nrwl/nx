import {
  PageEvent,
  Reflection,
  ReflectionKind,
  Renderer,
  type RenderTemplate,
} from 'typedoc';
import { MarkdownTheme } from 'typedoc-plugin-markdown/dist/theme';

/**
 * The MarkdownTheme is based on TypeDoc's DefaultTheme @see https://github.com/TypeStrong/typedoc/blob/master/src/lib/output/themes/DefaultTheme.ts.
 * - html specific components are removed from the renderer
 * - markdown specefic components have been added
 */
export default class NxMarkdownTheme extends MarkdownTheme {
  constructor(renderer: Renderer) {
    super(renderer);
    // NOTE: removing this still has the ToC showing up on each page?
    // toc(this);
  }

  render(
    page: PageEvent<Reflection>,
    template: RenderTemplate<PageEvent<Reflection>>
  ): string {
    let content = super.render(page, template);

    // Remove type-specific directories from links to flatten URL structure
    // e.g., /docs/reference/devkit/enums/ChangeType.md -> /docs/reference/devkit/ChangeType.md
    content = content
      // Remove type directories (enums, classes, interfaces, types, variables, functions) from URLs
      .replace(
        /(\[.*?\]\([^)]*?\/devkit\/)(?:enums|classes|interfaces|types|variables|functions)\//gi,
        '$1'
      )
      // Handle ngcli_adapter paths - keep the ngcli_adapter prefix but remove type directories
      .replace(
        /(\[.*?\]\([^)]*?\/devkit\/ngcli_adapter\/)(?:enums|classes|interfaces|types|variables|functions)\//gi,
        '$1'
      )
      // Remove .md extensions from all links
      .replace(/(\[.*?\]\([^)]*?)\.md(\)|#)/gi, '$1$2')
      // Also handle any remaining .md extensions that might be in URLs
      .replace(/\.md(?=[#)]|$)/gi, '');

    return content;
  }

  get mappings() {
    return [
      {
        kind: [ReflectionKind.Module],
        isLeaf: true,
        directory: '.',
        template: this.getReflectionTemplate(),
      },
      {
        kind: [ReflectionKind.Enum],
        isLeaf: false,
        directory: '.',
        template: this.getReflectionTemplate(),
      },
      {
        kind: [ReflectionKind.Class],
        isLeaf: false,
        directory: '.',
        template: this.getReflectionTemplate(),
      },
      {
        kind: [ReflectionKind.Interface],
        isLeaf: false,
        directory: '.',
        template: this.getReflectionTemplate(),
      },
      ...(this.allReflectionsHaveOwnDocument
        ? [
            {
              kind: [ReflectionKind.TypeAlias],
              isLeaf: true,
              directory: '.',
              template: this.getReflectionMemberTemplate(),
            },
            {
              kind: [ReflectionKind.Variable],
              isLeaf: true,
              directory: '.',
              template: this.getReflectionMemberTemplate(),
            },
            {
              kind: [ReflectionKind.Function],
              isLeaf: true,
              directory: '.',
              template: this.getReflectionMemberTemplate(),
            },
          ]
        : []),
    ];
  }

  /**
   * Returns the full url of a given mapping and reflection
   */
  toUrl(mapping: Record<string, unknown>, reflection: Reflection) {
    // Keep .md for actual file generation
    return (
      (mapping.directory === '.' ? '' : mapping.directory + '/') +
      this.getUrl(reflection) +
      '.md'
    );
  }
}
