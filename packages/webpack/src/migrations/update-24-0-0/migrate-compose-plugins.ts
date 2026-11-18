import { formatFiles, type Tree } from '@nx/devkit';
import { convertConfigToWebpackPluginGenerator } from '../../generators/convert-config-to-webpack-plugin/convert-config-to-webpack-plugin';
import { inventoryComposePlugins, type HelperUsage } from './inventory';

const CONVERTER = '@nx/webpack:convert-config-to-webpack-plugin';

export default async function migrateComposePlugins(tree: Tree) {
  const usages = inventoryComposePlugins(tree);
  if (!usages.length) {
    return { skipAgentic: true };
  }

  const converted: HelperUsage[] = [];
  const remaining: { usage: HelperUsage; reason: string }[] = [];
  const moduleFederation: HelperUsage[] = [];

  for (const usage of usages) {
    if (!usage.usesHelpers) {
      converted.push(usage);
      continue;
    }
    if (usage.usesModuleFederation) {
      moduleFederation.push(usage);
      continue;
    }

    try {
      await convertConfigToWebpackPluginGenerator(tree, {
        project: usage.name,
        skipFormat: true,
      });
      converted.push(usage);
    } catch (e) {
      remaining.push({ usage, reason: (e as Error).message });
    }
  }

  if (converted.length) {
    await formatFiles(tree);
  }

  return {
    nextSteps: nextSteps(converted, remaining),
    agentContext: agentContext(converted, remaining, moduleFederation),
  };
}

function nextSteps(
  converted: HelperUsage[],
  remaining: { usage: HelperUsage; reason: string }[]
): string[] {
  const steps: string[] = [];
  if (converted.length) {
    steps.push(
      `Inline the \`webpack.config.old.*\` files that ${CONVERTER} left behind in ${converted.length} project(s), then drop \`useLegacyNxPlugin\`.`
    );
  }
  if (remaining.length) {
    steps.push(
      `Migrate ${remaining.length} project(s) off the removed webpack config helpers by hand: ${remaining
        .map(({ usage }) => usage.name)
        .join(', ')}.`
    );
  }
  return steps;
}

function agentContext(
  converted: HelperUsage[],
  remaining: { usage: HelperUsage; reason: string }[],
  moduleFederation: HelperUsage[]
): string[] {
  const context: string[] = [];

  if (converted.length) {
    context.push(
      `${CONVERTER} converted these projects. Each one now has a standard config whose \`useLegacyNxPlugin\` call still loads the renamed \`.old\` config, so the helper callbacks it holds have to move into the new config before the \`.old\` file can go:`,
      ...converted.map(
        (usage) =>
          `- ${usage.name} (${usage.root}): ${usage.configPaths.join(', ')}`
      )
    );
  }

  if (remaining.length) {
    context.push(
      `${CONVERTER} could not convert these projects, so their configs are untouched and still call the removed helpers. Rewrite each one by hand:`,
      ...remaining.map(
        ({ usage, reason }) =>
          `- ${usage.name} (${usage.root}): ${usage.configPaths.join(', ')} - ${reason}`
      )
    );
  }

  if (moduleFederation.length) {
    context.push(
      `These projects compose Module Federation helpers, so their configs are untouched. The @nx/module-federation migration handles them; do not convert them here:`,
      ...moduleFederation.map(
        (usage) =>
          `- ${usage.name} (${usage.root}): ${usage.configPaths.join(', ')}`
      )
    );
  }

  return context;
}
