import {
  ButtonLink,
  SectionHeading,
  Strong,
  TextLink,
} from '@nx/nx-dev/ui-common';
import Image from 'next/image';

export function WorkBetterAchieveMoreShipQuicker(): JSX.Element {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="max-w-5xl">
        <SectionHeading
          as="h2"
          variant="title"
          id="achieve-more-ship-quicker"
          className="scroll-mt-24"
        >
          Collaborate better. Achieve more. Ship faster.
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          <Strong>Tangled codebases</Strong> without well-defined ownership{' '}
          <Strong>crush the velocity</Strong> of teams and the quality of
          products. Nx is the solution. By defining{' '}
          <TextLink
            href="/features/enforce-module-boundaries?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_achieve_more_ship_quicker"
            title="Enforce module boundaries"
          >
            project boundaries
          </TextLink>
          , developers ensure code stays <Strong>modular</Strong> and easy to
          maintain. By using{' '}
          <TextLink
            href="/concepts/nx-plugins?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_achieve_more_ship_quicker"
            title="What are plugins?"
          >
            Nx plugins
          </TextLink>{' '}
          and{' '}
          <TextLink
            href="/features/generate-code?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_achieve_more_ship_quicker"
            title="Generate code"
          >
            code generation
          </TextLink>{' '}
          , developers <Strong>standardize</Strong> on best practices and reduce
          duplication. Plus, they <Strong>keep everything up-to-date</Strong> by
          using Nx's{' '}
          <TextLink
            href="/features/automate-updating-dependencies?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_achieve_more_ship_quicker"
            title="Automate updating dependencies"
          >
            automated updating mechanism
          </TextLink>
          .
        </SectionHeading>
        <div className="mt-10 flex gap-x-6">
          <ButtonLink
            href="/getting-started/intro?utm_source=homepage&utm_medium=website&utm_campaign=homepage_links&utm_content=cta_achieve_more_ship_quicker_getstarted#try-nx-yourself"
            title="Get started"
            variant="primary"
            size="large"
          >
            Try Nx for yourself
          </ButtonLink>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:gap-32">
        <div className="group/card rounded-2xl border border-slate-100 bg-slate-50/30 p-6 transition-all duration-500 dark:border-slate-800/60 dark:bg-black">
          <SectionHeading
            as="h3"
            variant="title"
            className="text-center sm:text-2xl"
          >
            From overwhelming...
          </SectionHeading>
          <Image
            src="/images/home/yarn-light.avif"
            width={700}
            height={700}
            alt="chaos"
            className="translation-all block max-w-full duration-500 group-hover/card:brightness-95 dark:hidden"
          />
          <Image
            src="/images/home/yarn-dark.avif"
            width={700}
            height={700}
            alt="chaos"
            className="translation-all hidden max-w-full duration-500 group-hover/card:brightness-200 dark:block"
          />
        </div>
        <div className="group/card rounded-2xl border border-slate-100 bg-slate-50/30 p-6 transition-all duration-500 dark:border-slate-800/60 dark:bg-black">
          <SectionHeading
            as="h3"
            variant="title"
            className="text-center sm:text-2xl"
          >
            ...to structured with clear ownership.
          </SectionHeading>

          <Image
            src="/images/home/order-light.avif"
            width={1000}
            height={1000}
            alt="order"
            className="translation-all block max-w-full duration-500 group-hover/card:brightness-95 dark:hidden"
          />
          <Image
            src="/images/home/order-dark.avif"
            width={1000}
            height={1000}
            alt="order"
            className="translation-all hidden max-w-full duration-500 group-hover/card:brightness-200 dark:block"
          />
        </div>
      </div>
    </article>
  );
}
