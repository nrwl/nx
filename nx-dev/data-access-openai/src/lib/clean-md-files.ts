import * as fs from 'fs';
import { promisify } from 'util';
import * as glob from 'glob';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const CALLOUT_PATTERN = /{% callout.*?%}(.*?){% \/callout %}/gs;
const YOUTUBE_PATTERN = /{% youtube.*?%}/gs;
const GITHUB_PATTERN = /{% github-repository.*?%}/gs;
const COMMAND_PATTERN = /{% command="(.*?)" path=".*?" %}/gs;
const CARD_PATTERN = /{% card.*?%}/gs;

export async function adjustFileContent(file: string) {
  const data = await readFile(file, 'utf-8');

  // Remove callouts
  let result = data.replace(CALLOUT_PATTERN, '$1');

  // Remove youtube links
  result = result.replace(YOUTUBE_PATTERN, '');

  // Remove github-repository links
  result = result.replace(GITHUB_PATTERN, '');

  // Replace commands with their plain version
  result = result.replace(COMMAND_PATTERN, '$ $1');

  // Remove cards
  result = result.replace(CARD_PATTERN, '');

  // Write the result back to the file
  try {
    await writeFile(file, result, 'utf-8');
  } catch (error) {
    console.log('O no error');
    throw error;
  }
}

export async function cleanMdFiles() {
  const files = glob.sync('../pages/**/*.md');
  for (const file of files) {
    await adjustFileContent(file);
  }
}
