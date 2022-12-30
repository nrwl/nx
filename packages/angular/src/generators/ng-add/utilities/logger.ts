import { logger } from '@nrwl/devkit';

export class Logger {
  private message = (_: TemplateStringsArray, message: string) =>
    `[${this.project}] ${message}`;

  constructor(private project: string) {}

  public info(message: string): void {
    logger.info(this.message`${message}`);
  }

  public warn(message: string): void {
    logger.warn(this.message`${message}`);
  }

  public error(message: string): void {
    logger.error(this.message`${message}`);
  }
}
