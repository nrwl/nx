import {
  AmericanAirlinesIcon,
  AwsIcon,
  BillIcon,
  CapitalOneIcon,
  CaterpillarIcon,
  CiscoIcon,
  FicoIcon,
  HiltonIcon,
  ManIcon,
  RoyalBankOfCanadaIcon,
  SevenElevenIcon,
  ShopifyIcon,
  StorybookIcon,
  VmwareIcon,
} from '@nx/nx-dev-ui-icons';
import { ReactElement } from 'react';
import { Marquee } from '@nx/nx-dev-ui-animations';
import { cx } from '@nx/nx-dev-ui-primitives';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/20/solid';

export function CustomerLogos(): ReactElement {
  const icons = [
    {
      Icon: AwsIcon,
      className: 'size-14',
    },
    {
      Icon: ManIcon,
      className: 'size-14',
    },
    {
      Icon: CapitalOneIcon,
      className: 'size-28',
    },
    {
      Icon: ShopifyIcon,
      className: null,
    },
    {
      Icon: RoyalBankOfCanadaIcon,
      className: null,
    },
    {
      Icon: VmwareIcon,
      className: 'size-24',
    },
    {
      Icon: StorybookIcon,
      className: null,
    },
    {
      Icon: FicoIcon,
      className: 'size-20',
    },
    {
      Icon: CaterpillarIcon,
      className: null,
    },
    {
      Icon: CiscoIcon,
      className: 'size-16',
    },
    {
      Icon: BillIcon,
      className: null,
    },
    {
      Icon: SevenElevenIcon,
      className: null,
    },
    {
      Icon: HiltonIcon,
      className: 'size-24',
    },
    {
      Icon: AmericanAirlinesIcon,
      className: null,
    },
  ];

  return (
    <section
      id="customer-logos"
      className="group/canvas relative mx-auto flex max-w-7xl overflow-hidden text-slate-950 dark:text-slate-100"
    >
      <Marquee className="w-full justify-center overflow-hidden [--duration:240s] [--gap:6rem]">
        {icons.map((e, idx) => (
          <e.Icon
            key={'icon-' + idx}
            aria-hidden="true"
            className={cx('mx-auto size-12', e.className)}
          />
        ))}
      </Marquee>
      <div className="absolute bottom-0 left-0 top-0 w-1/3 max-w-60 bg-gradient-to-r from-white to-white/0 dark:from-slate-950 dark:to-slate-950/0"></div>
      <div className="absolute bottom-0 right-0 top-0 w-1/3 max-w-60 bg-gradient-to-r from-white/0 to-white dark:from-slate-950/0 dark:to-slate-950"></div>
      <div className="absolute inset-0 grid grid-cols-1 place-items-center bg-white/60 opacity-0 backdrop-blur-sm transition-all duration-200 group-hover/canvas:opacity-100 dark:bg-slate-950/60">
        <Link
          href="/customers"
          title="See our customers"
          className="group/link relative flex items-center gap-2 text-base font-semibold drop-shadow"
        >
          <span>See our customers</span>{' '}
          <ChevronRightIcon
            aria-hidden="true"
            className="size-5 transform transition-all group-hover/link:translate-x-1"
          />
        </Link>
      </div>
    </section>
  );
}
