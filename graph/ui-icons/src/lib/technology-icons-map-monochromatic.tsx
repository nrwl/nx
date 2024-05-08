import { FunctionComponent, SVGProps } from 'react';
import { AngularIcon } from './technologies/angular';
import { CypressIcon } from './technologies/cypress';
import { EsbuildIcon } from './technologies/esbuild';
import { EslintIcon } from './technologies/eslint';
import { ExpoIcon } from './technologies/expo';
import { ExpressIcon } from './technologies/express';
import { GradleIcon } from './technologies/gradle';
import { HTML5Icon } from './technologies/html5';
import { JavaScriptIcon } from './technologies/javascript';
import { JestIcon } from './technologies/jest';
import { NestJSIcon } from './technologies/nestjs';
import { NextJSIcon } from './technologies/nextjs';
import { NodeIcon } from './technologies/nodejs';
import { NuxtIcon } from './technologies/nuxtjs';
import { PlaywrightIcon } from './technologies/playwright';
import { PrettierIcon } from './technologies/prettier';
import { ReactIcon } from './technologies/react';
import { RemixIcon } from './technologies/remix';
import { RollupIcon } from './technologies/rollup';
import { RspackIcon } from './technologies/rspack';
import { StorybookIcon } from './technologies/storybook';
import { TypeScriptIcon } from './technologies/typescript';
import { ViteIcon } from './technologies/vite';
import { VitestIcon } from './technologies/vitest';
import { VueIcon } from './technologies/vue';
import { WebpackIcon } from './technologies/webpack';

export const MonochromaticTechnologyIconsMap: Record<
  string,
  { icon: FunctionComponent<SVGProps<SVGSVGElement>> }
> = {
  angular: { icon: AngularIcon },
  cypress: { icon: CypressIcon },
  detox: { icon: ReactIcon },
  esbuild: { icon: EsbuildIcon },
  eslint: { icon: EslintIcon },
  expo: { icon: ExpoIcon },
  express: { icon: ExpressIcon },
  gradle: { icon: GradleIcon },
  javascript: { icon: JavaScriptIcon },
  jest: { icon: JestIcon },
  nest: { icon: NestJSIcon },
  next: { icon: NextJSIcon },
  node: { icon: NodeIcon },
  nuxt: { icon: NuxtIcon },
  playwright: { icon: PlaywrightIcon },
  prettier: { icon: PrettierIcon },
  react: { icon: ReactIcon },
  reactnative: { icon: ReactIcon },
  remix: { icon: RemixIcon },
  rollup: { icon: RollupIcon },
  rspack: { icon: RspackIcon },
  storybook: { icon: StorybookIcon },
  typescript: { icon: TypeScriptIcon },
  vite: { icon: ViteIcon },
  vitest: { icon: VitestIcon },
  vue: { icon: VueIcon },
  webcomponents: { icon: HTML5Icon },
  webpack: { icon: WebpackIcon },
};
