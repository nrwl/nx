/* eslint-disable @typescript-eslint/no-unused-vars */
import { Tree } from '../../generators/tree';
import { updateDotenvFiles } from '../../generators/internal-utils/update-dotenv-files';

export default function update(host: Tree) {
  updateDotenvFiles(host, (contents) =>
    contents
      .split('\n')
      .map((line) => {
        line = line.trim();

        // Line is either not a declaration, or doesn't contain a hash anyways.
        if (!line.includes('#') || !line.includes('=')) {
          return line;
        }

        let separatorIdx = line.indexOf('=');
        let prop = line.slice(0, separatorIdx);
        let value = line.slice(separatorIdx + 1);

        prop = prop.trim();
        value = value.trim();

        let comment: string;
        const maybeCommentIdx = value.indexOf(' #');
        if (maybeCommentIdx > -1) {
          let quoteCount = 0;
          for (let i = maybeCommentIdx - 1; i >= 0; i--) {
            if (value[i] === '') {
              quoteCount++;
            }
          }
          // If there is an odd number of quotes, then the hash is inside a string.
          // If there is an even number of quotes, then the hash is outside a string and may be a valid comment
          if (quoteCount % 2 === 0) {
            comment = value.slice(maybeCommentIdx);
            value = value.slice(0, maybeCommentIdx);
          }
        }

        // Value starts with a hash, or contains a hash with a non-whitespace character before it.
        if (
          value.startsWith('#') ||
          (/\S\#/g.test(value) && !value.startsWith("'"))
        ) {
          value = `'${value}'`;
        } else {
          return line;
        }

        return `${prop}=${value}${comment ?? ''}`;
      })
      .join('\n')
  );
}
