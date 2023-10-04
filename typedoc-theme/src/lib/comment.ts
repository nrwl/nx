import * as Handlebars from 'handlebars';
import { CommentDisplayPart } from 'typedoc/dist/lib/models/comments/comment';

export default function () {
  Handlebars.registerHelper('comment', function (parts: CommentDisplayPart[]) {
    const result: string[] = [];
    for (const part of parts) {
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
                const url =
                  typeof part.target === 'string'
                    ? part.target
                    : Handlebars.helpers.relativeURL((part.target as any).url);
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
  });
}
