import type { Tree } from '@nrwl/devkit';
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

  constructor(private readonly tree: Tree, private readonly filePath: string) {
    this.setContentToFileContent();
  }

  applyChanges(): void {
    this.tree.write(this.filePath, this.mutableContent.toString());
  }

  insertLeft(index: number, content: string): void {
    this.mutableContent.appendLeft(index, content);
  }

  insertRight(index: number, content: string): void {
    this.mutableContent.appendRight(index, content);
  }

  remove(index: number, length: number): void {
    this.mutableContent.remove(index, length);
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
