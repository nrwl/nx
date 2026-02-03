import * as pc from 'picocolors';
import { output } from '../../../utils/output';

const colors = [
  { instance: pc.green, spinnerColor: 'green' },
  { instance: pc.greenBright, spinnerColor: 'green' },
  { instance: pc.red, spinnerColor: 'red' },
  { instance: pc.redBright, spinnerColor: 'red' },
  { instance: pc.cyan, spinnerColor: 'cyan' },
  { instance: pc.cyanBright, spinnerColor: 'cyan' },
  { instance: pc.yellow, spinnerColor: 'yellow' },
  { instance: pc.yellowBright, spinnerColor: 'yellow' },
  { instance: pc.magenta, spinnerColor: 'magenta' },
  { instance: pc.magentaBright, spinnerColor: 'magenta' },
] as const;

function getColor(projectName: string) {
  let code = 0;
  for (let i = 0; i < projectName.length; ++i) {
    code += projectName.charCodeAt(i);
  }
  const colorIndex = code % colors.length;

  return colors[colorIndex];
}

export class ProjectLogger {
  private logs: string[] = [];
  private color: (typeof colors)[number];

  constructor(private projectName: string) {
    this.color = getColor(projectName);
  }

  buffer(msg: string) {
    this.logs.push(msg);
  }

  flush() {
    if (this.logs.length === 0) {
      return;
    }
    output.logSingleLine(
      `Running release version for project: ${pc.bold(
        this.color.instance(this.projectName)
      )}`
    );
    this.logs.forEach((msg) => {
      console.log(pc.bold(this.color.instance(this.projectName)) + ' ' + msg);
    });
    this.logs = [];
  }
}
