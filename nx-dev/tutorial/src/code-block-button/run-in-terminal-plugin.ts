import { PluginTexts, type ExpressiveCodePlugin } from '@expressive-code/core';
import { pluginCodeBlockButton } from './base-plugin';

const svg = [
  `<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='2 2 20 20' stroke-width='1.5' stroke='currentColor' class='size-6'>`,
  `<path stroke-linecap='round' stroke-linejoin='round' d='M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z' />`,
  `</svg>`,
].join('');

export const runInTerminalTexts = new PluginTexts({
  buttonTooltip: 'Run in terminal',
  buttonExecuted: 'Command executing...',
});

export function runInTerminalPlugin(): ExpressiveCodePlugin {
  return pluginCodeBlockButton(
    'runInTerminal',
    svg,
    runInTerminalTexts,
    (codeBlock, isTerminal) =>
      isTerminal && !codeBlock.metaOptions.getBoolean('no-run'),
    (codeBlock, _) => {
      // remove comment lines starting with `#` from terminal frames
      let code = codeBlock.code.replace(/(?<=^|\n)\s*#.*($|\n+)/g, '').trim();

      /**
       * Replace all line breaks with a special character
       * because HAST does not encode them in attribute values
       * (which seems to work, but looks ugly in the HTML source)
       */
      code = code.replace(/\n/g, '\u007f');
      return {
        'data-code': code,
      };
    }
  );
}
