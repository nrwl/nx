import {
  type SignatureReflection,
  type ParameterReflection,
  type CommentDisplayPart,
  type SomeType,
  type DeclarationReflection,
  ReflectionKind,
  type InlineTagDisplayPart,
  Reflection,
} from 'typedoc';
import { allowedReflections } from './typedoc/setupTypeDoc';

/**
 * returns a Record with a string content formatted like:
 * <summary>
 *   ## Properties
 *   ### <propName>
 *   - **propName**: `type`
 *   <description>
 *
 *   ## Methods
 *   ### <methodName>
 *   - **methodName (`param1: type, param2: type`): `returnType`**
 *   <description>
 *   ### Parameters
 *    | Name | Type | Description |
 *    | ---- | ---- | ----------- |
 *    | **paramName** | `type` | <description>
 *  ### Returns
 *  `returnType` // might be linkable
 *
 *
 * also other metadata that might be useful like deprecation notices
 */
export function formatDeclarationToMarkdown(
  reflection: DeclarationReflection,
  childRefs: DeclarationReflection[] = [],
  baseSlug: string
): { content: string; [metadata: string]: string | boolean | number | null } {
  const metadata: Record<string, string | boolean | number | null> = {};
  let content = '';

  if (reflection.comment) {
    if (reflection.comment.summary) {
      content += formatComment(reflection.comment.summary, baseSlug) + '\n\n';
    }
    if (reflection.comment.blockTags) {
      for (const tag of reflection.comment.blockTags) {
        if (tag.tag === '@deprecated') {
          content += `:::caution[Deprecated]\n`;
          content += formatComment(tag.content, baseSlug) + '\n';
          content += `:::\n`;
          metadata['deprecated'] = true;
        } else {
          content += `**@${tag.tag}**: ${formatComment(tag.content, baseSlug)}`;
        }
      }
    }
  }

  if (reflection.signatures) {
    content += '## Signatures\n\n';
    for (const sig of reflection.signatures) {
      const code = formatMethodSignature(sig);
      content += formatCodeBlock(code, 'typescript');
      content += '\n\n';

      if (sig.comment?.summary) {
        content += formatComment(sig.comment.summary, baseSlug) + '\n\n';
      }

      if (sig.parameters && sig.parameters.length > 0) {
        content += '### Parameters\n\n';
        content += formatParameterTable(sig.parameters, baseSlug);
      }
      content += '\n';
    }
  }

  // we don't use the reflection.children since it seems to be a partial list of children
  // and merging the two lists can result in type lost, where one reflection.children intrinsic types seem almost always be `any`
  const allChildren = childRefs.sort((a, b) => a.name.localeCompare(b.name));
  const seenProperties = new Set<number>();
  const seenMethods = new Set<number>();

  if (allChildren.length > 0) {
    const properties = allChildren.filter(
      (child) => child.kind === ReflectionKind.Property
    );

    if (properties.length > 0) {
      content += '## Properties\n\n';
      for (const prop of properties) {
        if (seenProperties.has(prop.id)) {
          continue;
        }
        seenProperties.add(prop.id);
        content += `### ${prop.name}\n\n`;
        content += `**${prop.name}**: \`${formatType(prop.type)}\`\n\n`;
        if (prop.comment?.summary) {
          content += formatComment(prop.comment.summary, baseSlug) + '\n\n';
        }
      }
    }

    const methods = allChildren.filter(
      (child) => child.kind === ReflectionKind.Method
    );

    if (methods.length > 0) {
      content += '## Methods\n\n';
      for (const method of methods) {
        if (seenMethods.has(method.id)) {
          continue;
        }
        seenMethods.add(method.id);
        content += `### ${method.name}\n\n`;
        if (method.comment?.summary) {
          content += formatComment(method.comment.summary, baseSlug);
        }
        // for function overload, but I don't think we actually do that in devkit but just in case^tm
        for (const methodSig of method.signatures || []) {
          if (methodSig.comment?.summary) {
            content +=
              formatComment(methodSig.comment.summary, baseSlug) + '\n';
          }
          content += '`' + formatMethodSignature(methodSig) + '`\n\n';
          if (methodSig.parameters && methodSig.parameters.length > 0) {
            content += '#### Parameters\n\n';
            content += formatParameterTable(methodSig.parameters, baseSlug);
            content += '\n\n';
          }
        }
      }
    }
  }

  return {
    content,
    ...metadata,
  };
}

/**
 * Formats a code block into markdown
 *
 * if a lang is not provided or is `shell` then we remove any frame on the code block as well
 * an optional filename can also be provided
 * @example
 * ```lang
 * // fileName
 * code
 * ```
 */
export function formatCodeBlock(
  code: string,
  lang?: string,
  fileName?: string
) {
  let content = '';
  if (!code) return content;

  content += '```';
  if (!lang || lang === 'shell') {
    content += `shell {% frame="none" %}\n`;
  } else {
    content += `${lang}\n`;
  }

  if (fileName) {
    content += `// ${fileName}\n`;
  }

  content += code;

  content += '\n```';

  return content;
}

/**
 * Formats a method signature in a single link to be
 * @example
 * methodName(params: type, params2: type2): returnType
 */
export function formatMethodSignature(methodSig: SignatureReflection) {
  return `${methodSig.name}(${formatParameters(
    methodSig.parameters
  )}): ${formatType(methodSig.type)}`;
}

/**
 * Formats a methods parameter list into markdown table
 * @example
 * | Name | Type | Description |
 * | ---- | ---- | ----------- |
 * | ...  | .... |    ....     |
 */
export function formatParameterTable(
  params: ParameterReflection[],
  baseSlug: string
): string {
  let content = '';

  if (params.length === 0) return content;

  content += '| Name | Type | Description |\n';
  content += '| ---- | ---- | ----------- |\n';
  for (const param of params) {
    content += `| **${param.name}** | \`${formatType(param.type)}\` | ${
      param.comment?.summary
        ? formatComment(param.comment.summary, baseSlug)
        : '_no description_'
    } |\n`;
  }

  return content;
}

/**
 * Formats a parameter into a list of comma separated parameters w/ types
 * @example
 * params: type, params2: type2
 **/
export function formatParameters(parameters?: ParameterReflection[]): string {
  if (!parameters || parameters.length === 0) return '';
  return parameters.map((p) => `${p.name}: ${formatType(p.type)}`).join(', ');
}

/**
 * Formats a type into a named type based on the typedoc information
 * other wise it returns 'any'
 * if not provided then `unknown` is returned
 *
 * @example
 * `any` | `unknown` | `string` | `number` | `boolean` | `Object` | any[] | 'literal' etc...`
 */
export function formatType(type?: SomeType): string {
  if (!type) return 'unknown';

  if (type.type === 'intrinsic') {
    return (type as any).name || 'any';
  } else if (type.type === 'reference') {
    const cast = type as any;
    // see if the type has the parent project with the lookup map so we can try to map the reference type to a link
    if (
      '_project' in cast &&
      'reflectionIdToSymbolMap' in cast._project &&
      '_target' in cast &&
      typeof cast._target === 'number'
    ) {
      const maybeRef = cast._project.reflectionIdToSymbolMap.get(cast._target);
      if (maybeRef) {
        return `[${cast.name}](/docs/reference/devkit/${maybeRef.name})`;
      }
    }
    return (type as any).name || 'any';
  } else if (type.type === 'union') {
    const types = (type as any).types;
    return types ? types.map((t: any) => formatType(t)).join(' | ') : 'any';
  } else if (type.type === 'array') {
    const elementType = (type as any).elementType;
    return elementType ? `${formatType(elementType)}[]` : 'any[]';
  } else if (type.type === 'literal') {
    return (type as any).value ? `'${(type as any).value}'` : 'any';
  } else if (type.type === 'reflection') {
    return 'Object';
  }

  return 'any';
}

export function formatComment(comment: CommentDisplayPart[], baseSlug: string) {
  const result: string[] = [];
  for (const part of comment) {
    switch (part.kind) {
      case 'text':
      case 'code':
        result.push(part.text);
        break;
      case 'inline-tag':
        switch (part.tag) {
          case '@label':
          case '@inheritdoc':
            break;
          case '@link':
          case '@linkcode':
          case '@linkplain': {
            if (part.target) {
              const baseUrl = `/docs/reference/devkit${
                baseSlug === 'ngcli_adapter' ? `/${baseSlug}` : ''
              }`;

              const url = parseTagForUrl(part, baseUrl);

              const wrap = part.tag === '@linkcode' ? '`' : '';
              result.push(
                url ? `[${wrap}${part.text}${wrap}](${url})` : part.text
              );
            } else {
              result.push(part.text);
            }
            break;
          }
          default:
            result.push(`{${part.tag} ${part.text}}`);
            break;
        }
        break;
      default:
        result.push('');
    }
  }

  return result
    .join('')
    .split('\n')
    .filter((line) => !line.startsWith('@note'))
    .join('\n');
}

function parseTagForUrl(part: InlineTagDisplayPart, baseUrl: string) {
  if (!part || !part.target) {
    return baseUrl;
  }

  if (typeof part.target === 'string') {
    return part.target;
  }

  const normalizedUrlText = part.text.replace(/\s/g, '');

  // we have a nested level declaration that should be on the same page as the root declaration
  // these are linked to by url fragments
  if (
    'parent' in part.target &&
    part.target.parent &&
    part.target.parent.name !== '@nx/devkit'
  ) {
    // astro/starlight lowercases all url fragments and is how the ToC links to headers
    return `${baseUrl}/${part.target.parent.name.replace(
      /\s/g,
      ''
    )}#${normalizedUrlText.toLowerCase()}`;
  }

  return `${baseUrl}/${normalizedUrlText}`;
}
