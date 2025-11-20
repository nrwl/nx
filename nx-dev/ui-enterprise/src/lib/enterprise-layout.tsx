import { Footer, Header, ButtonLinkProps } from '@nx/nx-dev-ui-common';
import { PropsWithChildren, ReactElement } from 'react';

export function EnterpriseLayout({
  children,
  headerCTAConfig,
  scrollCTAConfig,
}: {
  headerCTAConfig?: ButtonLinkProps[];
  scrollCTAConfig?: ButtonLinkProps[];
} & PropsWithChildren): ReactElement {
  return (
    <div className="w-full dark:bg-slate-950">
      <Header ctaButtons={headerCTAConfig} scrollCtaButtons={scrollCTAConfig} />
      <main data-document="main">{children}</main>
      <Footer />
    </div>
  );
}
