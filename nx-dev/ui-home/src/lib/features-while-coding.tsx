import { SectionHeading, Strong, TextLink } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';
import { FeatureContainer } from './feature-container';
import Image from 'next/image';

export function FeaturesWhileCoding(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <FeatureContainer icon="code">
        <div className="flex max-w-5xl items-start gap-8">
          <div className="w-1/2">
            <SectionHeading
              as="h2"
              variant="title"
              id=""
              className="scroll-mt-24"
            >
              While Coding
            </SectionHeading>
            <div className="max-w-5xl">
              <SectionHeading as="p" variant="subtitle" className="mt-6">
                At the foundation is Nx Core, a Rust-based, technology-agnostic
                task runner. Nx Core creates a knowledge graph of your
                workspace, understanding project relationships and dependencies.
                This enables highly optimized and fast task execution regardless
                of technology stack.
              </SectionHeading>
              <SectionHeading as="p" variant="subtitle" className="mt-6">
                AI-powered coding assistants can edit files, but they're blind
                to the bigger picture – they don't understand how your entire
                codebase fits together. Nx changes that. With full visibility
                into your monorepo's project relationships, dependencies, and
                ownership, Nx enables your LLM to move beyond local file changes
                to make informed architectural decisions. Future-proof your
                development with system-wide intelligence, not just AI-friendly
                tools.
              </SectionHeading>
            </div>
          </div>
          <div className="w-1/2">
            <Image
              src="/images/home/features-coding.png"
              width={800}
              height={800}
              alt=""
              className="max-w-[full] lg:max-w-[full]"
            />
          </div>
        </div>
      </FeatureContainer>
    </article>
  );
}
