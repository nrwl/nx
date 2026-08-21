import { FunctionComponent, SVGProps } from 'react';
import { AngularIcon } from './technologies/angular';
import { BiomeIcon } from './technologies/biome';
import { CypressIcon } from './technologies/cypress';
import { EsbuildIcon } from './technologies/esbuild';
import { EslintIcon } from './technologies/eslint';
import { ExpoIcon } from './technologies/expo';
import { ExpressIcon } from './technologies/express';
import { HTML5Icon } from './technologies/html5';
import { JavaIcon } from './technologies/java';
import { JavaScriptIcon } from './technologies/javascript';
import { JestIcon } from './technologies/jest';
import { NestJSIcon } from './technologies/nestjs';
import { OxfmtIcon } from './technologies/oxfmt';
import { OxlintIcon } from './technologies/oxlint';
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
import { TanStackStartIcon } from './technologies/tanstack-start';
import { TypeScriptIcon } from './technologies/typescript';
import { ViteIcon } from './technologies/vite';
import { VitePlusIcon } from './technologies/viteplus';
import { VitestIcon } from './technologies/vitest';
import { VueIcon } from './technologies/vue';
import { WebpackIcon } from './technologies/webpack';
import { DockerIcon } from './technologies/docker';
import { CSharpIcon } from './technologies/csharp';
import { DotnetIcon } from './technologies/dotnet';
import { FSharpIcon } from './technologies/fsharp';
import { VisualBasicIcon } from './technologies/visualbasic';

export const MonochromaticTechnologyIconsMap: Record<
  string,
  { icon: FunctionComponent<SVGProps<SVGSVGElement>>; className?: string }
> = {
  angular: { icon: AngularIcon },
  biome: { icon: BiomeIcon },
  'C#': { icon: CSharpIcon },
  cypress: { icon: CypressIcon },
  detox: { icon: ReactIcon },
  docker: { icon: DockerIcon },
  dotnet: { icon: DotnetIcon },
  esbuild: { icon: EsbuildIcon },
  eslint: { icon: EslintIcon },
  expo: { icon: ExpoIcon },
  oxfmt: { icon: OxfmtIcon },
  oxlint: { icon: OxlintIcon },
  express: { icon: ExpressIcon },
  'F#': { icon: FSharpIcon },
  gradle: { icon: JavaIcon, className: 'text-slate-600 dark:text-slate-300' },
  java: { icon: JavaIcon, className: 'text-slate-600 dark:text-slate-300' },
  javascript: { icon: JavaScriptIcon },
  jest: { icon: JestIcon },
  maven: { icon: JavaIcon, className: 'text-slate-600 dark:text-slate-300' },
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
  'tanstack-start': { icon: TanStackStartIcon },
  typescript: { icon: TypeScriptIcon },
  vite: { icon: ViteIcon },
  viteplus: { icon: VitePlusIcon },
  'vite-plus': { icon: VitePlusIcon },
  vitest: { icon: VitestIcon },
  VB: { icon: VisualBasicIcon },
  vue: { icon: VueIcon },
  webcomponents: { icon: HTML5Icon },
  webpack: { icon: WebpackIcon },
};
