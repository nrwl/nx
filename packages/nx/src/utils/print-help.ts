import { Schema } from './params';
import * as chalk from 'chalk';
import { logger, stripIndent } from './logger';

function formatOption(
  name: string,
  description: string,
  maxPropertyNameLength: number
) {
  const lengthOfKey = Math.max(maxPropertyNameLength + 4, 22);
  return `  --${`${name}                                                 `.substr(
    0,
    lengthOfKey
  )}${description}`;
}

export function printHelp(
  header: string,
  schema: Schema,
  meta:
    | { mode: 'generate'; plugin: string; entity: string }
    | { mode: 'run'; plugin: string; entity: string }
) {
  const allPositional = Object.keys(schema.properties).filter((key) => {
    const p = schema.properties[key];
    return p['$default'] && p['$default']['$source'] === 'argv';
  });
  const positional = allPositional.length > 0 ? ` [${allPositional[0]}]` : '';
  const maxPropertyNameLength = Object.keys(schema.properties)
    .map((n) => n.length)
    .reduce((a, b) => Math.max(a, b), 0);
  const args = Object.keys(schema.properties)
    .map((name) => {
      const d = schema.properties[name];
      const def = d.default ? ` (default: ${d.default})` : '';
      return formatOption(
        name,
        `${d.description}${def}`,
        maxPropertyNameLength
      );
    })
    .join('\n');

  const missingFlags =
    meta.mode === 'generate'
      ? formatOption(
          'dry-run',
          'Preview the changes without updating files',
          maxPropertyNameLength
        )
      : formatOption(
          'skip-nx-cache',
          'Skip the use of Nx cache.',
          maxPropertyNameLength
        );

  let linkDescription = null;
  // we need to generalize link generation so it works for non-party-class plugins as well
  if (meta.mode === 'generate' && meta.plugin.startsWith('@nrwl/')) {
    linkDescription = generateLink(meta.plugin, meta.entity, 'generators');
  } else if (meta.mode === 'run' && meta.plugin.startsWith('@nrwl/')) {
    linkDescription = generateLink(meta.plugin, meta.entity, 'executors');
  }

  logger.info(
    stripIndent(`
${chalk.bold(`${header + positional} [options,...]`)}

${chalk.bold('Options')}:
${args}
${missingFlags}${linkDescription}
  `)
  );
}

function generateLink(plugin: string, entity: string, type: string) {
  const link = `https://nx.dev/packages/${plugin.substring(
    6
  )}/${type}/${entity}`;
  return chalk.bold(`\n\nFind more information and examples at ${link}`);
}
