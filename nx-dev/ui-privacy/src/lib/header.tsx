import { SectionHeading, SectionDescription } from '@nx/nx-dev/ui-common';

export function Heading() {
  return (
    <header className="mx-auto max-w-prose">
      <div className="text-center">
        <SectionHeading as="h2" variant="title">
          Privacy Policy
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Effective date: July 2, 2024
        </SectionHeading>
      </div>

      <SectionDescription as="p" className="mt-12">
        This Privacy Notice applies to the processing of personal information by
        Narwhal Technologies, Inc. (&quot;
        <strong>Nx</strong>
        ,&quot; &quot;<strong>us</strong>,&quot; &quot;
        <strong>we</strong>,&quot; or &quot;
        <strong>our</strong>&quot;), including on our website available at
        https://nx.app/ and our other online or offline offerings which link to,
        or are otherwise subject to, this Privacy Notice (collectively, the
        &quot;<strong>Services</strong>&quot;).
      </SectionDescription>
    </header>
  );
}
