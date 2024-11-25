'use client';
import { ButtonLink, SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient';
import { BlurFade, usePrefersReducedMotion } from '@nx/nx-dev/ui-animations';
import { Theme, useTheme } from '@nx/nx-dev/ui-theme';
import { useState } from 'react';
import { useIsomorphicLayoutEffect } from '@nx/nx-dev/ui-primitives';
import { RustIcon, TypeScriptIcon } from '@nx/nx-dev/ui-icons';

export function Hero(): JSX.Element {
  return (
    <div className="mx-auto h-screen w-full max-w-7xl px-6 lg:px-8">
      <div className="hidden lg:block">
        <ShaderGradientElement />
      </div>
      <div className="absolute left-0 right-0 -z-10 mx-auto flex h-full max-h-screen w-full flex-row justify-between border-b border-dashed border-slate-200/30 px-6 lg:h-full lg:max-w-7xl lg:px-0 dark:border-slate-800/40">
        <div className="h-full w-full border-x border-dashed border-slate-200/20 dark:border-slate-800/40" />
        <div className="h-full w-full border-x border-dashed border-slate-200/20 dark:border-slate-800/40" />
        <div className="h-full w-full border-x border-dashed border-slate-200/20 dark:border-slate-800/40" />
        <div className="h-full w-full border-x border-dashed border-slate-200/20 dark:border-slate-800/40" />
        <div className="h-full w-full border-x border-dashed border-slate-200/20 dark:border-slate-800/40" />
        <div className="h-full w-full border-x border-dashed border-slate-200/20 dark:border-slate-800/40" />
      </div>
      <div className="z-20 mx-auto grid h-screen max-w-6xl grid-cols-1 place-items-center text-center">
        <div className="container">
          <SectionHeading as="h1" variant="display" data-cy="primary-heading">
            <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
              Smart
            </span>{' '}
            Monorepos
            <br className="sm:hidden" />
            <svg
              viewBox="0 0 2 2"
              fill="currentColor"
              className="mx-6 hidden size-2 sm:inline-flex xl:size-3"
            >
              <circle cx={1} cy={1} r={1} />
            </svg>
            <span className="rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
              Fast
            </span>{' '}
            CI
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-4xl"
          >
            <Strong>Build system</Strong>, optimized for monorepos, with plugins
            for popular frameworks and tools and{' '}
            <Strong>advanced CI capabilities</Strong> including caching and
            distribution.
          </SectionHeading>
          <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row">
            <ButtonLink
              href="/getting-started/intro?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_hero_get_started"
              title="Get started"
              variant="primary"
              size="default"
            >
              Get started
            </ButtonLink>

            <ButtonLink
              href="ci/intro/ci-with-nx?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_hero_get_started&utm_source=nxdev"
              title="Learn about Nx on CI"
              variant="contrast"
              size="default"
            >
              Learn about Nx on CI
            </ButtonLink>
            <ButtonLink
              href="/nx-cloud"
              title="Try Nx Cloud for free"
              variant="secondary"
              size="default"
            >
              Try Nx Cloud for free
            </ButtonLink>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm italic">
            Built with
            <RustIcon aria-hidden="true" className="size-5 shrink-0" />
            <span className="sr-only">Rust</span> for speed &
            <TypeScriptIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">TypeScript</span> for extensibility.
          </div>
        </div>
      </div>
    </div>
  );
}

function ShaderGradientElement() {
  const [theme] = useTheme();
  const [displayTheme, setDisplayTheme] = useState<Theme>('system');
  const prefersReducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const matchMedia: any = window.matchMedia('(prefers-color-scheme: dark)');

    function handleChange(): void {
      if (theme === 'system') {
        setDisplayTheme(matchMedia.matches ? 'dark' : 'light');
      } else {
        setDisplayTheme(theme === 'dark' ? 'dark' : 'light');
      }
    }

    handleChange();

    // Use deprecated `addListener` and `removeListener` to support Safari < 14 (#135)
    if (matchMedia.addListener) {
      matchMedia.addListener(handleChange);
    } else {
      matchMedia.addEventListener('change', handleChange);
    }

    return () => {
      if (matchMedia.removeListener) {
        matchMedia.removeListener(handleChange);
      } else {
        matchMedia.removeEventListener('change', handleChange);
      }
    };
  }, [theme]);

  if (prefersReducedMotion) {
    return;
  }

  if (displayTheme === 'dark')
    return (
      <BlurFade
        delay={1}
        duration={1.8}
        className="absolute left-0 -z-10 w-full"
      >
        <div className="h-screen w-full overflow-hidden">
          <ShaderGradientCanvas
            pointerEvents="none"
            eventPrefix="client"
            fov={45}
            pixelDensity={1}
            className="pointer-events-none"
          >
            <ShaderGradient
              brightness={4}
              cDistance={5}
              color1="#251B36"
              color2="#020617"
              color3="#1F1C3A"
              frameRate={10}
              grain="off"
              lightType="3d"
              positionX={0}
              positionY={1.8}
              positionZ={0}
              range="enabled"
              rangeEnd={40}
              rangeStart={0}
              reflection={0.1}
              rotationX={0}
              rotationY={0}
              rotationZ={-90}
              shader="defaults"
              type="waterPlane"
              uDensity={1}
              uFrequency={5.5}
              uSpeed={0.1}
              uStrength={3}
              uTime={0.2}
            />
          </ShaderGradientCanvas>
          <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-b from-transparent to-white dark:to-slate-950" />
        </div>
      </BlurFade>
    );
  return (
    <BlurFade delay={1} duration={1.8} className="absolute left-0 -z-10 w-full">
      <div className="h-screen w-full overflow-hidden">
        <ShaderGradientCanvas
          pointerEvents="none"
          eventPrefix="client"
          fov={45}
          pixelDensity={1}
          className="pointer-events-none"
        >
          <ShaderGradient
            brightness={4}
            cDistance={5}
            color1="#F4F2FE"
            color2="#F7F7FF"
            color3="#FFFFFF"
            frameRate={10}
            grain="off"
            lightType="3d"
            positionX={0}
            positionY={1.8}
            positionZ={0}
            range="enabled"
            rangeEnd={40}
            rangeStart={0}
            reflection={0.1}
            rotationX={0}
            rotationY={0}
            rotationZ={-90}
            shader="defaults"
            type="waterPlane"
            uDensity={1}
            uFrequency={5.5}
            uSpeed={0.1}
            uStrength={3}
            uTime={0.2}
          />
        </ShaderGradientCanvas>
        <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-b from-transparent to-white dark:to-slate-950" />
      </div>
    </BlurFade>
  );
}
