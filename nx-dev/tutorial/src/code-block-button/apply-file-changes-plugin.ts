import { PluginTexts, type ExpressiveCodePlugin } from '@expressive-code/core';
import { pluginCodeBlockButton } from './base-plugin';

const svg = `<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='2 2 20 20' stroke-width='1.5' stroke='currentColor' class='size-6'><path stroke-linecap='round' stroke-linejoin='round' d='M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' /></svg>`;

export const applyFileChangesTexts = new PluginTexts({
  buttonTooltip: 'Apply file changes',
  buttonExecuted: 'File updated...',
});

export function applyFileChangesPlugin(): ExpressiveCodePlugin {
  return pluginCodeBlockButton(
    'applyFileChanges',
    svg,
    applyFileChangesTexts,
    (codeBlock, isTerminal) =>
      !isTerminal &&
      ['solution:', 'file:'].some(
        (prefix) =>
          codeBlock.metaOptions.getString('path')?.startsWith(prefix) &&
          !codeBlock.metaOptions.getBoolean('no-apply')
      ),
    (codeBlock, _) => {
      return {
        'data-filepath': codeBlock.metaOptions
          .getString('path')
          .replace('solution:', '')
          .replace('file:', ''),
      };
    }
  );
}
