import * as Handlebars from 'handlebars';
import {
  DeclarationReflection,
  ProjectReflection,
  ReflectionGroup,
  ReflectionKind,
} from 'typedoc';
import NxMarkdownTheme from './theme';

export function escapeChars(str: string) {
  return str
    .replace(/>/g, '\\>')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|');
}
export function stripLineBreaks(str: string) {
  return str
    ? str
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/[\s]{2,}/g, ' ')
        .trim()
    : '';
}

export default function (theme: NxMarkdownTheme) {
  Handlebars.registerHelper(
    'toc',
    function (this: ProjectReflection | DeclarationReflection) {
      const md: string[] = [];

      const { hideInPageTOC } = theme;

      const isVisible = this.groups?.some((group) =>
        group.allChildrenHaveOwnDocument()
      );

      function pushGroup(group: ReflectionGroup, md: string[]) {
        const children = group.children.map((child) => {
          const propertyType = [
            ReflectionKind.Property,
            ReflectionKind.Variable,
          ].includes(child.kind)
            ? ': ' + getPropertyType(child)
            : '';
          return `- [${escapeChars(
            child.name
          )}](${Handlebars.helpers.relativeURL(child.url)})${propertyType}`;
        });
        md.push(children.join('\n'));
      }

      if ((!hideInPageTOC && this.groups) || (isVisible && this.groups)) {
        if (!hideInPageTOC) {
          md.push(`## Table of contents\n\n`);
        }
        const headingLevel = hideInPageTOC ? `##` : `###`;
        this.groups?.forEach((group) => {
          const groupTitle = group.title;
          if (group.categories) {
            group.categories.forEach((category) => {
              md.push(`${headingLevel} ${category.title} ${groupTitle}\n\n`);
              pushGroup(category as any, md);
              md.push('\n');
            });
          } else {
            if (!hideInPageTOC || group.allChildrenHaveOwnDocument()) {
              md.push(`${headingLevel} ${groupTitle}\n\n`);
              pushGroup(group, md);
              md.push('\n');
            }
          }
        });
      }
      return md.length > 0 ? md.join('\n') : null;
    }
  );
}

function getPropertyType(property: any) {
  if (property.getSignature) {
    return property.getSignature.type;
  }
  if (property.setSignature) {
    return property.setSignature.type;
  }
  return property.type ? property.type : property;
}
