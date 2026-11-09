import type { Tree } from '@nx/devkit';
import MagicString from 'magic-string';
import type { Node } from 'typescript';

export class FileChangeRecorder {
  private mutableContent: MagicString;

  get content(): string {
    return this.mutableContent.toString();
  }

  get originalContent(): string {
    return this.mutableContent.original;
  }

  constructor(
    private readonly tree: Tree,
    private readonly filePath: string
  ) {
    this.setContentToFileContent();
  }

  applyChanges(): void {
    this.tree.write(this.filePath, this.mutableContent.toString());
  }

  hasChanged(): boolean {
    return this.mutableContent.hasChanged();
  }

  insertLeft(index: number, content: string): void {
    this.mutableContent.appendLeft(index, content);
  }

  insertRight(index: number, content: string): void {
    this.mutableContent.appendRight(index, content);
  }

  remove(index: number, end: number): void {
    this.mutableContent.remove(index, end);
  }

  replace(node: Node, content: string): void {
    this.mutableContent.overwrite(node.getStart(), node.getEnd(), content);
  }

  setContentToFileContent(): void {
    this.mutableContent = new MagicString(
      this.tree.read(this.filePath, 'utf-8')
    );
  }
}

// Removes the elements `shouldRemove` matches from a comma-separated list,
// with their separators, and appends `newElement` after the remaining ones.
export function spliceListElements(
  recorder: FileChangeRecorder,
  elements: readonly Node[],
  closingTokenStart: number,
  shouldRemove: (element: Node) => boolean,
  newElement?: string
): void {
  let tailStart = elements.length;
  while (tailStart > 0 && shouldRemove(elements[tailStart - 1])) {
    tailStart--;
  }
  for (let i = 0; i < tailStart; i++) {
    if (shouldRemove(elements[i])) {
      recorder.remove(elements[i].getStart(), elements[i + 1].getStart());
    }
  }

  const last = elements[elements.length - 1];
  if (tailStart < elements.length) {
    const tailStartPosition = elements[tailStart].getStart();
    if (newElement !== undefined) {
      recorder.remove(tailStartPosition, last.getEnd());
      recorder.insertLeft(tailStartPosition, newElement);
    } else if (tailStart > 0) {
      recorder.remove(elements[tailStart - 1].getEnd(), last.getEnd());
    } else {
      recorder.remove(tailStartPosition, closingTokenStart);
    }
  } else if (newElement !== undefined) {
    if (!last) {
      recorder.insertLeft(closingTokenStart, ` ${newElement} `);
    } else {
      const leadingWhitespace = recorder.originalContent.slice(
        last.getFullStart(),
        last.getStart()
      );
      const separator =
        leadingWhitespace.includes('\n') && !leadingWhitespace.trim()
          ? `,${leadingWhitespace}`
          : ', ';
      recorder.insertLeft(last.getEnd(), `${separator}${newElement}`);
    }
  }
}
