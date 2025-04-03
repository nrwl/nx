import { Footer, Header } from '@nx/nx-dev/ui-common';
import { PropsWithChildren, ReactElement } from 'react';

export function EnterpriseLayout({
  children,
}: PropsWithChildren): ReactElement {
  return (
    <div className="w-full dark:bg-slate-950">
      <Header />
      <main data-document="main">{children}</main>
      <Footer />
    </div>
  );
}
