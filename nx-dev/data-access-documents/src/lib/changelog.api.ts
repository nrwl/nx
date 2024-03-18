import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface ChangelogRawContentEntry {
  version: string;
  content: string;
  filePath: string;
}

export class ChangelogApi {
  constructor(
    private readonly options: {
      id: string;
      changelogRoot: string;
    }
  ) {
    if (!options.id) {
      throw new Error('id cannot be undefined');
    }
    if (!options.changelogRoot) {
      throw new Error('public docs root cannot be undefined');
    }
  }

  getChangelogEntries(): ChangelogRawContentEntry[] {
    const files = readdirSync(this.options.changelogRoot);

    return files.map((file) => {
      const filePath = join(this.options.changelogRoot, file);
      const content = readFileSync(filePath, 'utf8');
      const version = file.replace('.md', '').replace(/_/g, '.');
      return {
        content,
        version,
        filePath,
      };
    });
  }
}
