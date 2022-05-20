import * as chalk from 'chalk';

export function addCommandPrefixIfNeeded(
  projectName: string,
  chunk: any,
  encoding: string
) {
  if (process.env.NX_PREFIX_OUTPUT === 'true') {
    const lines = (
      typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
    ).split('\n');
    return {
      content: addPrefixToLines(projectName, lines).join('\n'),
      encoding: 'utf-8',
    };
  } else {
    return { content: chunk, encoding: encoding };
  }
}

export function addPrefixToLines(projectName: string, lines: string[]) {
  const updatedLines = [];
  for (let i = 0; i < lines.length; ++i) {
    if (i === lines.length - 1 && lines[i] === '') {
      updatedLines.push('');
    } else {
      updatedLines.push(`${projectNamePrefix(projectName)} ${lines[i]}`);
    }
  }
  return updatedLines;
}

const colors = [
  chalk.green,
  chalk.greenBright,
  chalk.red,
  chalk.redBright,
  chalk.cyan,
  chalk.cyanBright,
  chalk.yellow,
  chalk.yellowBright,
  chalk.magenta,
  chalk.magentaBright,
];

function projectNamePrefix(projectName: string) {
  const n = normalizeProjectName(projectName);
  return colors[projectNameToIndex(projectName)](`[${n}]`);
}

function projectNameToIndex(projectName: string): number {
  let code = 0;
  for (let i = 0; i < projectName.length; ++i) {
    code += projectName.charCodeAt(i);
  }
  return code % colors.length;
}

function normalizeProjectName(projectName: string): string {
  return projectName.length > 15
    ? `...${projectName.substring(projectName.length - 12)}`
    : `${projectName}                     `.substring(0, 15);
}
