import { SectionHeading, SectionDescription } from '@nx/nx-dev/ui-common';
import Link from 'next/link';

export function Header() {
  return (
    <header className="mx-auto max-w-prose">
      <div className="text-center">
        <SectionHeading as="h2" variant="title">
          Nx Terms of Service
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Effective July 2, 2024 (Version 4.0)
        </SectionHeading>
      </div>

      <SectionDescription as="p" className="mt-12">
        Welcome to the Nx website located at https://nx.app/ (the &quot;
        <strong>Site</strong>&quot;). If you have signed up either
        electronically through our Site to purchase a subscription to access and
        use the Software (as defined below), and have not otherwise executed a
        separate written subscription agreement with us, then please read these
        Nx Terms of Service (together with your associated Order Information (as
        defined below), the &quot;<strong>Agreement</strong>&quot;) carefully
        because they govern your use of our hosted continuous integration
        solution for software development (the &quot;
        <strong>Software&quot;</strong>). To make this Agreement easier to read,
        the terms &quot;<strong>Nx</strong>,&quot; &quot;
        <strong>we</strong>
        ,&quot; and &quot;<strong>us</strong>&quot; refers to Narwhal
        Technologies, Inc., and the term &quot;you&quot; refers to you and any
        organization that you are acting on behalf of in signing up for a
        subscription to the Software. If you are an individual acting on behalf
        of an entity, you represent and warrant that you have the authority to
        enter into this Agreement on behalf of that entity and to legally bind
        that entity. If you do not accept the terms of this Agreement, then you
        are not permitted to, and you must not access or otherwise use the
        Software.
      </SectionDescription>
      <SectionDescription as="p" className="mt-4">
        Please also see the corresponding{' '}
        <Link href="/privacy" prefetch={false} className="underline">
          Privacy Policy
        </Link>{' '}
        for details on how Nrwl manages your personal data.
      </SectionDescription>
    </header>
  );
}
