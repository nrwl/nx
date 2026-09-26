// Expressive Code options. Node loads this file as plain ESM, so keep it
// self-contained - importing a .ts module here fails silently and drops the config.

const PROMPT = '$ ';

// The copy button holds its payload in the `dataCode` hast property, with
// newlines encoded as \x7F for the Expressive Code client script to decode.
const ENCODED_NEWLINE = '\u007f';

// Command line indices per block, recorded before the prompts are stripped.
const commandLines = new WeakMap();

function findCopyButton(node) {
  for (const child of node.children ?? []) {
    if (child.type !== 'element') continue;
    if (child.tagName === 'button' && 'dataCode' in child.properties)
      return child;
    const found = findCopyButton(child);
    if (found) return found;
  }
  return undefined;
}

// Puts the prompt back as its own span, in front of the highlighted command.
function prependPrompt(node) {
  const codeWrapper = (node.children ?? []).find(
    (child) =>
      child.type === 'element' && child.properties.className?.includes('code')
  );
  codeWrapper?.children.unshift({
    type: 'element',
    tagName: 'span',
    properties: { className: ['shell-prompt'] },
    children: [{ type: 'text', value: PROMPT }],
  });
}

/**
 * Lets a block marked `{% prompt=true %}` show a command next to its output.
 * Lines prefixed with `$ ` are the commands: the prompt is stripped before
 * highlighting so the command is syntax highlighted like any other shell
 * block, other lines are tagged `is-output` for global.css to mute, and the
 * copy button hands over the commands alone.
 *
 * Opt-in rather than automatic, since a captured terminal transcript can
 * contain a `$ ` line that is output rather than something to run.
 */
function shellPrompts() {
  return {
    name: 'shell-prompts',
    hooks: {
      preprocessCode: ({ codeBlock }) => {
        if (!codeBlock.metaOptions.getBoolean('prompt')) return;

        const lines = codeBlock.getLines();
        const commands = new Map();
        lines.forEach((line, index) => {
          if (!line.text.startsWith(PROMPT)) return;
          commands.set(index, line.text.slice(PROMPT.length).trim());
          line.editText(0, PROMPT.length, '');
        });
        if (commands.size > 0) commandLines.set(codeBlock, commands);
      },
      postprocessRenderedLine: ({ codeBlock, lineIndex, renderData }) => {
        const commands = commandLines.get(codeBlock);
        if (!commands) return;

        if (commands.has(lineIndex)) {
          prependPrompt(renderData.lineAst);
        } else {
          renderData.lineAst.properties.className.push('is-output');
        }
      },
      postprocessRenderedBlock: ({ codeBlock, renderData }) => {
        const commands = commandLines.get(codeBlock);
        if (!commands) return;

        const button = findCopyButton(renderData.blockAst);
        if (button) {
          button.properties.dataCode = [...commands.values()].join(
            ENCODED_NEWLINE
          );
        }
      },
    },
  };
}

export default {
  plugins: [shellPrompts()],
};
