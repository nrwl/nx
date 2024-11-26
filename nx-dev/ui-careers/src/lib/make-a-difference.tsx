import { SectionHeading } from '@nx/nx-dev/ui-common';

export function MakeADifference() {
  return (
    <div
      id="careers"
      className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8"
    >
      <SectionHeading as="h2" variant="display">
        Make a difference
      </SectionHeading>
      <SectionHeading as="p" variant="subtitle" className="mt-6">
        We build tools helping companies scale and modernize their development
        practices.
      </SectionHeading>
    </div>
  );
}
