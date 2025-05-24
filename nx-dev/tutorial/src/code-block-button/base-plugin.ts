import type {
  ExpressiveCodeBlock,
  ExpressiveCodePlugin,
  ResolverContext,
} from '@expressive-code/core';
import { codeLineClass, PluginTexts } from '@expressive-code/core';
import { h } from '@expressive-code/core/hast';
import codeBlockButtonJsModule from './js-module.min';

const terminalLanguageGroups = [
  'ansi',
  'bash',
  'bat',
  'batch',
  'cmd',
  'console',
  'nu',
  'nushell',
  'powershell',
  'ps',
  'ps1',
  'psd1',
  'psm1',
  'sh',
  'shell',
  'shellscript',
  'shellsession',
  'zsh',
];

export function isTerminalLanguage(language: string) {
  return terminalLanguageGroups.includes(language);
}

export const frameTypes = ['code', 'terminal', 'none', 'auto'] as const;
export type FrameType = (typeof frameTypes)[number];

export function getFramesBaseStyles(
  name: string,
  svg: string,
  { cssVar }: ResolverContext
) {
  const escapedSvg = svg.replace(/</g, '%3C').replace(/>/g, '%3E');
  const svgUrl = `url("data:image/svg+xml,${escapedSvg}")`;

  const buttonStyles = `.${name} {
    display: flex;
    gap: 0.25rem;
    flex-direction: row;
    position: absolute;
    inset-block-start: calc(${cssVar('borderWidth')} + var(--button-spacing));
    inset-inline-end: calc(${cssVar('borderWidth')} + ${cssVar(
    'uiPaddingInline'
  )} / 2 + var(--button-spacing));

    /* hide code block button when there is no JavaScript */
    @media (scripting: none) {
      display: none;
    }

    html.unsupported & {
      display: none;
    }

    /* RTL support: Code is always LTR, so the inline code block button
       must match this to avoid overlapping the start of lines */
    direction: ltr;
    unicode-bidi: isolate;

    button {
        position: relative;
        align-self: flex-end;
        margin: 0;
        padding: 0;
        border: none;
        border-radius: 0.2rem;
        z-index: 1;
        cursor: pointer;

        transition-property: opacity, background, border-color;
        transition-duration: 0.2s;
        transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);

        /* Mobile-first styles: Make the button visible and tappable */
        width: 2.5rem;
        height: 2.5rem;
        background: var(--code-background);
        opacity: 0.75;

        div {
            position: absolute;
            inset: 0;
            border-radius: inherit;

            background: ${cssVar('frames.inlineButtonBackground')};
            opacity: ${cssVar('frames.inlineButtonBackgroundIdleOpacity')};

            transition-property: inherit;
            transition-duration: inherit;
            transition-timing-function: inherit;
        }

        &::before {
            content: '';
            position: absolute;
            pointer-events: none;
            inset: 0;
            border-radius: inherit;
            border: ${cssVar('borderWidth')} solid ${cssVar(
    'frames.inlineButtonBorder'
  )};
            opacity: ${cssVar('frames.inlineButtonBorderOpacity')};
        }

        &::after {
            content: '';
            position: absolute;
            pointer-events: none;
            inset: 0;
            background-color: ${cssVar('frames.inlineButtonForeground')};
            -webkit-mask-image: ${svgUrl};
            -webkit-mask-repeat: no-repeat;
            mask-image: ${svgUrl};
            mask-repeat: no-repeat;
            margin: 0.475rem;
            line-height: 0;
        }

        /*
            On hover or focus, make the button fully opaque
            and set hover/focus background opacity
        */
        &:hover, &:focus:focus-visible {
            opacity: 1;
            div {
                opacity: ${cssVar(
                  'frames.inlineButtonBackgroundHoverOrFocusOpacity'
                )};
            }
        }

        /* On press, set active background opacity */
        &:active {
            opacity: 1;
            div {
                opacity: ${cssVar(
                  'frames.inlineButtonBackgroundActiveOpacity'
                )};
            }
        }
    }

    .feedback {
        --tooltip-arrow-size: 0.35rem;
        --tooltip-bg: ${cssVar('frames.tooltipSuccessBackground')};
        color: ${cssVar('frames.tooltipSuccessForeground')};
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        position: relative;
        align-self: center;
        background-color: var(--tooltip-bg);
        z-index: 99;
        padding: 0.125rem 0.75rem;
        border-radius: 0.2rem;
        margin-inline-end: var(--tooltip-arrow-size);
        opacity: 0;
        transition-property: opacity, transform;
        transition-duration: 0.2s;
        transition-timing-function: ease-in-out;
        transform: translate3d(0, 0.25rem, 0);

        &::after {
            content: '';
            position: absolute;
            pointer-events: none;
            top: calc(50% - var(--tooltip-arrow-size));
            inset-inline-end: calc(-2 * (var(--tooltip-arrow-size) - 0.5px));
            border: var(--tooltip-arrow-size) solid transparent;
            border-inline-start-color: var(--tooltip-bg);
        }

        &.show {
            opacity: 1;
            transform: translate3d(0, 0, 0);
        }
    }

}

@media (hover: hover) {
    /* If a mouse is available, hide the button by default and make it smaller */
    .${name} button {
        opacity: 0;
        width: 2rem;
        height: 2rem;
    }

    /* Reveal the non-hovered button in the following cases:
        - when the frame is hovered
        - when a sibling inside the frame is focused
        - when the code block button shows a visible feedback message
    */
    .frame:hover .${name} button:not(:hover),
    .frame:focus-within :focus-visible ~ .${name} button:not(:hover),
    .frame .${name} .feedback.show ~ button:not(:hover) {
        opacity: 0.75;
    }
}

/* Increase end padding of the first line for the code block button */
:nth-child(1 of .${codeLineClass}) .code {
    padding-inline-end: calc(2rem + ${cssVar('codePaddingInline')});
}`;

  return buttonStyles;
}

export interface PluginFramesProps {
  /**
   * The code block's title. For terminal frames, this is displayed as the terminal window title,
   * and for code frames, it's displayed as the file name in an open file tab.
   *
   * If no title is given, the plugin will try to automatically extract a title from a
   * [file name comment](https://expressive-code.com/key-features/frames/#file-name-comments)
   * inside your code, unless disabled by the `extractFileNameFromCode` option.
   */
  title: string;

  /**
   * Allows you to override the automatic frame type detection for a code block.
   *
   * The supported values are `code`, `terminal`, `none` and `auto`.
   *
   * @default `auto`
   */
  frame: FrameType;
}

export interface TextMap {
  buttonTooltip: string;
  buttonExecuted: string;
}

export const defaultPluginCodeBlockButtonTexts = new PluginTexts({
  buttonTooltip: 'Run in terminal',
  buttonExecuted: 'Command executing...',
});

const svg = [
  `<svg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='black' viewBox='0 0 16 16'>`,
  `<path style='stroke-width:1.67364' d='M 12.97535,8 2.5068619,2.5406619 l 0,10.8728961 z m 1.403517,-1.1001222 c 0.953442,0.4868922 0.953442,1.7133522 0,2.2002444 L 3.102884,14.935828 C 2.1813829,15.413179 0.91786322,14.86786 0.91786322,13.835705 V 2.1642945 c 0,-1.0321548 1.26351968,-1.57747398 2.18502078,-1.1001221 z'/>`,
  `</svg>`,
].join('');

export function pluginCodeBlockButton(
  name: string = 'runInTerminal',
  iconSvg: string = svg,
  pluginCodeBlockButtonTexts: PluginTexts<TextMap> = defaultPluginCodeBlockButtonTexts,
  shouldShowButton: (
    codeBlock: ExpressiveCodeBlock,
    isTerminal: boolean
  ) => boolean = () => true,
  addAttributes: (
    codeBlock: ExpressiveCodeBlock,
    isTerminal: boolean
  ) => Record<string, string> = () => ({})
): ExpressiveCodePlugin {
  return {
    name,
    baseStyles: (context: any) => getFramesBaseStyles(name, iconSvg, context),
    jsModules: [
      codeBlockButtonJsModule
        .replace('[SELECTOR]', `.expressive-code .${name} button`)
        .replace('[BUTTON_NAME]', name),
    ],
    hooks: {
      postprocessRenderedBlock: ({ codeBlock, renderData, locale }) => {
        // get text strings for the current locale
        const texts = pluginCodeBlockButtonTexts.get(locale);

        // retrieve information about the current block
        const { frame = 'auto' } = codeBlock.props;
        const isTerminal =
          frame === 'terminal' ||
          (frame === 'auto' && isTerminalLanguage(codeBlock.language));

        const extraElements: any[] = [];

        if (shouldShowButton(codeBlock, isTerminal)) {
          extraElements.push(
            h('div', { className: name }, [
              h(
                'button',
                {
                  title: texts.buttonTooltip,
                  'data-copied': texts.buttonExecuted,
                  ...addAttributes(codeBlock, isTerminal),
                },
                [h('div')]
              ),
            ])
          );
          renderData.blockAst.children.push(...extraElements);
        }
      },
    },
  };
}
