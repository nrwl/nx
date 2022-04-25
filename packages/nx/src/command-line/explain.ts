import * as chalk from 'chalk';
import { join, relative } from 'path';
import { nxConfigExplainer } from '../explain/config-explainers/nx-json';
import { workspaceRoot } from '../utils/app-root';
import { readJsonFile } from '../utils/fileutils';
import { output } from '../utils/output';

export interface ExplainArgs {
  config: string;
}

export const defaultNxJsonPath = join(workspaceRoot, 'nx.json');

export function explainHandler(args: ExplainArgs) {
  if (args.config === 'nx.json') {
    args.config = defaultNxJsonPath;
  }
  const resolvedPath = require.resolve(args.config, {
    paths: [process.cwd()],
  });
  const nxJson = readJsonFile(resolvedPath);

  output.log({
    title:
      resolvedPath === defaultNxJsonPath
        ? 'Explanation of your current nx.json settings'
        : `Explanation of the nx.json settings in ${relative(
            process.cwd(),
            resolvedPath
          )}`,
  });

  Object.entries(nxJson).forEach(([key, value], i, arr) => {
    const explainer = nxConfigExplainer[key];

    if (i === 0) {
      console.log('\n');
    }
    const linesToLog = [];
    linesToLog.push(` ${chalk.cyan.bold(key)}`);
    linesToLog.push('\n');

    const description = explainer.description;
    linesToLog.push('\n');
    for (const line of description.split('\n')) {
      linesToLog.push(chalk.dim(`${line}` + '\n'));
    }
    linesToLog.push('\n');
    linesToLog.push('\n');
    linesToLog.push(chalk.bold('Your Config:'));
    linesToLog.push('\n');

    if (typeof value === 'string') {
      linesToLog.push('\n');
      linesToLog.push(chalk.dim(`"${key}": "${value}"`));
      linesToLog.push('\n');
    } else {
      linesToLog.push('\n');
      const oneOrMoreLines = `"${key}": ${JSON.stringify(value, null, 2)}`;
      for (const line of oneOrMoreLines.split('\n')) {
        linesToLog.push(chalk.dim(`${line}`) + '\n');
      }
    }
    linesToLog.push('\n');
    linesToLog.push('\n');

    const explanation = explainer.explainConfig(value);

    explanation.split('\n').forEach((line, index) => {
      if (index === 0) {
        linesToLog.push(`→ ${line}` + '\n');
      } else {
        linesToLog.push(`${line}` + '\n');
      }
    });

    console.log(...linesToLog);

    if (i < arr.length - 1) {
      printFullWidthVerticalSeparator();
    } else {
      console.log('\n');
    }
  });
}

function printFullWidthVerticalSeparator() {
  let divider = '';
  for (let i = 0; i < process.stdout.columns; i++) {
    divider += '\u2014';
  }
  console.log('\n');
  console.log(chalk.dim(divider));
  console.log('\n');
}
