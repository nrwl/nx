export class LineAwareStream {
  private buffer = '';
  private activeProcessId: string | null = null;

  get currentProcessId(): string | null {
    return this.activeProcessId;
  }

  write(data: Buffer | string, processId: string): void {
    if (processId !== this.activeProcessId) return;

    const text = data.toString();
    this.buffer += text;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      process.stdout.write(line + '\n');
    }
  }

  flush(): void {
    if (this.buffer) {
      process.stdout.write(this.buffer + '\n');
      this.buffer = '';
    }
  }

  setActiveProcess(processId: string | null): void {
    this.flush();
    this.activeProcessId = processId;
  }
}
