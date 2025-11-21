export class LineAwareWriter {
  private buffer = '';
  private activeTaskId: string | null = null;

  get currentProcessId(): string | null {
    return this.activeTaskId;
  }

  write(data: Buffer | string, taskId: string): void {
    if (taskId !== this.activeTaskId) return;

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

  setActiveProcess(taskId: string | null): void {
    this.flush();
    this.activeTaskId = taskId;
  }
}
