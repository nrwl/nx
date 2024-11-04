import Link from 'next/link';
import { ReactNode } from 'react';
import { FitText } from '@nx/nx-dev/ui-animations';
import {
  ButtonLink,
  SectionHeading,
  Strong,
  TextLink,
} from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { motion } from 'framer-motion';
import {
  AngularIcon,
  AstroIcon,
  CypressIcon,
  DotNetIcon,
  EslintIcon,
  ExpoIcon,
  ExpressIcon,
  FastifyIcon,
  GoIcon,
  GradleIcon,
  JavaIcon,
  JestIcon,
  JetBrainsIcon,
  NestJSIcon,
  NextJSIcon,
  NodeIcon,
  NuxtIcon,
  PlaywrightIcon,
  PnpmIcon,
  QwikIcon,
  ReactIcon,
  RemixIcon,
  RollupIcon,
  RspackIcon,
  RustIcon,
  SolidIcon,
  StorybookIcon,
  TypeScriptIcon,
  VisualStudioCodeIcon,
  ViteIcon,
  VueIcon,
  WebpackIcon,
} from '@nx/nx-dev/ui-icons';

export function SmarterToolsForMonorepos(): JSX.Element {
  return (
    <section className="bg-slate-50 py-32 shadow-inner sm:py-40 dark:bg-slate-900">
      <article className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-5xl">
          <SectionHeading
            as="h2"
            variant="title"
            id="smarter-tools"
            className="scroll-mt-24"
          >
            Smarter tools for your monorepo.
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            Nx plugins are{' '}
            <Strong>like VSCode extensions, but for your Nx workspace</Strong>.
            Imagine your{' '}
            <TextLink
              href="/concepts/inferred-tasks?utm_source=homepage?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools"
              title="Inferred tasks"
            >
              tools being automatically detected
            </TextLink>
            , with{' '}
            <TextLink
              href="/features/cache-task-results?utm_source=homepage?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools"
              title="Caching"
            >
              caching
            </TextLink>
            ,{' '}
            <TextLink
              href="/ci/features/distribute-task-execution?utm_source=homepage?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools"
              title="Task distribution"
            >
              task distribution
            </TextLink>
            , and{' '}
            <TextLink
              href="/ci/features/distribute-task-execution?utm_source=homepage?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools"
              title="Task distribution"
            >
              task splitting
            </TextLink>{' '}
            being pre-configured for you. All in sync with your underlying
            tooling configuration. Plus there are{' '}
            <TextLink
              href="/features/generate-code?utm_source=homepage?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools"
              title="Task distribution"
            >
              code generators
            </TextLink>{' '}
            and utilities to help you integrate your favorite technologies,
            making working in a monorepo a much more pleasant experience.
          </SectionHeading>
        </div>

        <div className="relative mx-auto mt-24">
          {/*DESKTOP*/}
          <div className="mx-auto hidden lg:block">
            <div className="grid grid-cols-12 gap-8">
              <Card>
                <Link
                  href="/getting-started/tutorials/gradle-tutorial?utm_source=homepage?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Gradle"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <GradleIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/playwright?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Playwright"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <PlaywrightIcon
                    aria-hidden="true"
                    className="h-full w-full"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/getting-started/tutorials/npm-workspaces-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Typescript"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <TypeScriptIcon
                    aria-hidden="true"
                    className="h-full w-full"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="https://github.com/nrwl/nx-recipes/blob/main/go/README.md"
                  prefetch={false}
                  title="Nx with Go"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <GoIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/next?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Nextjs"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <NextJSIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/recipes/storybook?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Storybook"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <StorybookIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/rollup?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Rollup"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <RollupIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/jest?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Jest"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <JestIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/eslint?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with EsLint"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <EslintIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/recipes/adopting-nx/adding-to-monorepo?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Pnpm"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <PnpmIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/vite?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Vite"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <ViteIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/showcase/example-repos/add-solid?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Solid"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <SolidIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
            </div>
            <div className="my-4 grid grid-cols-4 gap-8">
              <Card>
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src="/images/home/video-tutorial-light.avif"
                    aria-hidden="true"
                    className="absolute block scale-125 object-cover opacity-50 dark:hidden"
                    alt="Nx Video tutorials card"
                  />
                  <img
                    src="/images/home/video-tutorial-dark.avif"
                    aria-hidden="true"
                    className="absolute hidden scale-125 object-cover opacity-50 dark:block"
                    alt="Nx Video tutorials card"
                  />
                </div>

                <Link
                  href="/getting-started/intro#learn-nx"
                  prefetch={false}
                  title="Nx video tutorials"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <FitText className="text-slate-950 dark:text-white">
                    Video tutorials
                  </FitText>
                </Link>
              </Card>
              <div className="col-span-2 row-span-1 grid grid-cols-6 gap-8">
                <div className="grid grid-cols-1 gap-8">
                  <Card>
                    <Link
                      href="/getting-started/tutorials/gradle-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                      prefetch={false}
                      title="Nx with Java"
                      className="h-full w-full p-2 sm:p-4"
                    >
                      <span className="absolute inset-0" />
                      <JavaIcon
                        aria-hidden="true"
                        className="h-full w-full shrink-0"
                      />
                    </Link>
                  </Card>
                  <Card>
                    <Link
                      href="/nx-api/remix?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                      prefetch={false}
                      title="Nx with Remix"
                      className="h-full w-full p-2 sm:p-4"
                    >
                      <span className="absolute inset-0" />
                      <RemixIcon
                        aria-hidden="true"
                        className="h-full w-full shrink-0"
                      />
                    </Link>
                  </Card>
                  <Card>
                    <Link
                      href="/getting-started/tutorials/angular-monorepo-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                      prefetch={false}
                      title="Nx with Angular"
                      className="h-full w-full p-2 sm:p-4"
                    >
                      <span className="absolute inset-0" />
                      <AngularIcon
                        aria-hidden="true"
                        className="h-full w-full"
                      />
                    </Link>
                  </Card>
                </div>
                <div className="col-span-4 grid grid-cols-1 place-items-center border-none bg-none p-0">
                  <div className="flex w-full items-center gap-4 pr-8">
                    <motion.div
                      initial={{
                        transform: 'translateY(4px)',
                      }}
                      animate={{
                        transform: 'translateY(-4px)',
                      }}
                      transition={{
                        duration: 10,
                        ease: 'anticipate',
                        delay: 0,
                        repeat: Infinity,
                        repeatType: 'reverse',
                      }}
                    >
                      <img
                        src="/images/home/crystal.avif"
                        alt="crystal"
                        className="h-[156px] w-[136px]"
                      />
                    </motion.div>
                    <FitText className="text-slate-950 dark:text-white">
                      Plugins
                    </FitText>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <Card>
                    <Link
                      href="/showcase/example-repos/add-rust?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                      prefetch={false}
                      title="Nx with Rust"
                      className="h-full w-full p-2 sm:p-4"
                    >
                      <span className="absolute inset-0" />
                      <RustIcon
                        aria-hidden="true"
                        className="h-full w-full shrink-0"
                      />
                    </Link>
                  </Card>
                  <Card>
                    <Link
                      href="/getting-started/tutorials/vue-standalone-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                      prefetch={false}
                      title="Nx with Vue"
                      className="h-full w-full p-2 sm:p-4"
                    >
                      <span className="absolute inset-0" />
                      <VueIcon
                        aria-hidden="true"
                        className="h-full w-full shrink-0"
                      />
                    </Link>
                  </Card>
                  <Card>
                    <Link
                      href="/nx-api/nuxt?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                      prefetch={false}
                      title="Nx with Nuxt"
                      className="h-full w-full p-2 sm:p-4"
                    >
                      <span className="absolute inset-0" />
                      <NuxtIcon
                        aria-hidden="true"
                        className="h-full w-full shrink-0"
                      />
                    </Link>
                  </Card>
                </div>
              </div>
              <Card className="p-4">
                <Link
                  href="/getting-started/editor-setup?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Webstorm plugin"
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs transition dark:border-slate-800 dark:bg-slate-900"
                >
                  <JetBrainsIcon aria-hidden="true" className="size-3" />{' '}
                  JetBrains
                </Link>
                <FitText className="text-slate-950 dark:text-white">
                  Editor Integration
                </FitText>
                <Link
                  href="/getting-started/editor-setup?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="VSCode plugin"
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <VisualStudioCodeIcon aria-hidden="true" className="size-3" />{' '}
                  VS Code
                </Link>
              </Card>
            </div>
            <div className="grid grid-cols-12 gap-8">
              <Card>
                <Link
                  href="https://github.com/nrwl/nx-recipes/tree/main/dot-net-standalone"
                  prefetch={false}
                  title="Nx with DotNet"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <DotNetIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/showcase/example-repos/add-astro?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Astro"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <AstroIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/cypress?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Cypress"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <CypressIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/getting-started/tutorials/react-monorepo-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with React"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <ReactIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/nest?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with NestJS"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <NestJSIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/showcase/example-repos/add-fastify?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Vitest"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <FastifyIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/rspack?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with RSpack"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <RspackIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/express?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Express"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <ExpressIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/webpack?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Webpack"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <WebpackIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/node?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with NodeJs"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <NodeIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="showcase/example-repos/add-qwik?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Qwik"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <QwikIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/expo?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Expo"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <ExpoIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
            </div>
          </div>
          {/*MOBILE*/}
          <div className="mx-auto max-w-5xl lg:hidden">
            <div className="mx-auto flex w-3/5 items-center gap-4 pr-8 sm:w-2/5 md:w-1/3">
              <motion.div
                initial={{
                  transform: 'translateY(4px)',
                }}
                animate={{
                  transform: 'translateY(-4px)',
                }}
                transition={{
                  duration: 10,
                  ease: 'anticipate',
                  delay: 0,
                  repeat: Infinity,
                  repeatType: 'reverse',
                }}
              >
                <img
                  src="/images/home/crystal.avif"
                  alt="crystal"
                  className="h-[156px] w-[136px]"
                />
              </motion.div>
              <FitText className="text-slate-950 dark:text-white">
                Plugins
              </FitText>
            </div>

            <div className="grid grid-cols-6 gap-4 sm:grid-cols-8 md:grid-cols-12">
              <Card>
                <Link
                  href="/getting-started/tutorials/gradle-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Gradle"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <GradleIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/playwright?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Playwright"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <PlaywrightIcon
                    aria-hidden="true"
                    className="h-full w-full"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/getting-started/tutorials/npm-workspaces-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Typescript"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <TypeScriptIcon
                    aria-hidden="true"
                    className="h-full w-full"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="https://github.com/nrwl/nx-recipes/blob/main/go/README.md"
                  prefetch={false}
                  title="Nx with Go"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <GoIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/next?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Nextjs"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <NextJSIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/recipes/storybook?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Storybook"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <StorybookIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/rollup?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Rollup"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <RollupIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/jest?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Jest"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <JestIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/eslint?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with EsLint"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <EslintIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/recipes/adopting-nx/adding-to-monorepo?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Pnpm"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <PnpmIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/vite?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Vite"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <ViteIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/showcase/example-repos/add-solid?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Solid"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <SolidIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/getting-started/tutorials/gradle-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Java"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <JavaIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/remix?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Remix"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <RemixIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/getting-started/tutorials/angular-monorepo-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Angular"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <AngularIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/showcase/example-repos/add-rust?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Rust"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <RustIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/getting-started/tutorials/vue-standalone-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Vue"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <VueIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/nuxt?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Nuxt"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <NuxtIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="https://github.com/nrwl/nx-recipes/tree/main/dot-net-standalone"
                  prefetch={false}
                  title="Nx with DotNet"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <DotNetIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/showcase/example-repos/add-astro?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Astro"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <AstroIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/cypress?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Cypress"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <CypressIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/getting-started/tutorials/react-monorepo-tutorial?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with React"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <ReactIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/nest?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with NestJS"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <NestJSIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/showcase/example-repos/add-fastify?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Vitest"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <FastifyIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/rspack?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with RSpack"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <RspackIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/express?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Express"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <ExpressIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/webpack?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Webpack"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <WebpackIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/node?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with NodeJs"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <NodeIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="showcase/example-repos/add-qwik?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Qwik"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <QwikIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
              <Card>
                <Link
                  href="/nx-api/expo?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                  prefetch={false}
                  title="Nx with Expo"
                  className="h-full w-full p-2 sm:p-4"
                >
                  <span className="absolute inset-0" />
                  <ExpoIcon
                    aria-hidden="true"
                    className="h-full w-full shrink-0"
                  />
                </Link>
              </Card>
            </div>
            <div className="mt-12 flex w-auto items-center justify-center gap-12">
              <ButtonLink
                href="/getting-started/intro#learn-nx"
                title="Nx video tutorials"
                variant="secondary"
              >
                Watch video tutorials
              </ButtonLink>
              <ButtonLink
                href="/getting-started/editor-setup?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_smarter_tools_techlink"
                title="Nx editor integration"
                variant="secondary"
              >
                See editor integration
              </ButtonLink>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

const Card = ({
  className = '',
  children,
}: {
  className?: string;
  children?: ReactNode;
}) => {
  return (
    <div
      className={cx(
        'relative col-span-1 row-span-1 grid grid-cols-1 place-items-center rounded-2xl border border-slate-100 bg-white dark:border-slate-800/60 dark:bg-slate-950',
        'text-slate-600 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
        className
      )}
    >
      {children}
    </div>
  );
};
