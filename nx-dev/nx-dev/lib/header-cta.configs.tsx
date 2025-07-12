import { ButtonLinkProps } from '@nx/nx-dev-ui-common';
import { NxCloudAnimatedIcon } from '@nx/nx-dev-ui-icons';

export const requestFreeTrial: ButtonLinkProps = {
  href: '/enterprise/trial',
  variant: 'primary',
  size: 'small',
  title: 'Request a free trial',
  children: 'Request a free trial',
};

export const tryNxCloudForFree: ButtonLinkProps = {
  href: '/pricing',
  variant: 'primary',
  size: 'small',
  title: 'Get started now',
  children: 'Get started now',
};

export const gotoAppButton: ButtonLinkProps = {
  href: 'https://nx.app/?utm_source=nx.dev&utm_medium=header-menu',
  variant: 'secondary',
  size: 'small',
  target: '_blank',
  title: 'Log in to your Nx Cloud Account',
  children: (
    <>
      <NxCloudAnimatedIcon className="h-4 w-4" aria-hidden="true" />
      <span>Go to app</span>
    </>
  ),
};

export const contactButton: ButtonLinkProps = {
  href: '/contact',
  variant: 'secondary',
  size: 'small',
  target: '_blank',
  title: 'Contact Us',
  children: <span>Contact</span>,
};
