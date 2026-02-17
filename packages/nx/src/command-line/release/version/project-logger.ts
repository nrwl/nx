import { styleText } from 'node:util';
import { output } from '../../../utils/output';

const colors = [
  { instance: (s: string) => styleText('green', s), spinnerColor: 'green' },
  {
    instance: (s: string) => styleText('greenBright', s),
    spinnerColor: 'green',
  },
  { instance: (s: string) => styleText('red', s), spinnerColor: 'red' },
  { instance: (s: string) => styleText('redBright', s), spinnerColor: 'red' },
  { instance: (s: string) => styleText('cyan', s), spinnerColor: 'cyan' },
  { instance: (s: string) => styleText('cyanBright', s), spinnerColor: 'cyan' },
  { instance: (s: string) => styleText('yellow', s), spinnerColor: 'yellow' },
  {
    instance: (s: string) => styleText('yellowBright', s),
    spinnerColor: 'yellow',
  },
  { instance: (s: string) => styleText('magenta', s), spinnerColor: 'magenta' },
  {
    instance: (s: string) => styleText('magentaBright', s),
    spinnerColor: 'magenta',
  },
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
      `Running release version for project: ${styleText(
        'bold',
        this.color.instance(this.projectName)
      )}`
    );
    this.logs.forEach((msg) => {
      console.log(
        styleText('bold', this.color.instance(this.projectName)) + ' ' + msg
      );
    });
    this.logs = [];
  }
}
