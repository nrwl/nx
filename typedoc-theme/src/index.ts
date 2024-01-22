import { Application } from 'typedoc';
import NxMarkdownTheme from './lib/theme';

export function load(app: Application) {
  app.renderer.defineTheme('nx-markdown-theme', NxMarkdownTheme);
}
