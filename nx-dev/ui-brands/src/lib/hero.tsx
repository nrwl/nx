import { SectionHeading } from '@nx/nx-dev/ui-common';

export function Hero() {
  return (
    <div
      id="hero"
      className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8"
    >
      <SectionHeading as="h2" variant="display">
        Brands & Guidelines
      </SectionHeading>
      <SectionHeading as="p" variant="subtitle" className="mt-6">
        We’ve created the following guidelines for 3rd party use of our logos,
        content, and trademarks.
      </SectionHeading>
    </div>
  );
}
