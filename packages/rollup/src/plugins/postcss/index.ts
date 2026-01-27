/**
 * @nx/rollup PostCSS plugin
 *
 * An inlined, simplified version of rollup-plugin-postcss that:
 * - Processes CSS files through PostCSS
 * - Supports CSS preprocessors (Sass, Less, Stylus)
 * - Supports CSS Modules
 * - Can inject CSS into DOM or extract to separate files
 *
 * This replaces the external rollup-plugin-postcss dependency to avoid
 * peer dependency conflicts and maintenance issues.
 */

export { postcss } from './postcss-plugin';
export { postcss as default } from './postcss-plugin';

export type {
  PostCSSPluginOptions,
  PostCSSModulesOptions,
  FilterPattern,
  UseOptions,
  LessOptions,
  SassOptions,
  StylusOptions,
} from './options';
