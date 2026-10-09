import { useId, useState } from 'react';
import { ComplexSetupIllustration } from './ComplexSetupIllustration';
import {
  resourcesGroups,
  solutionsGroups,
  type NavMenuGroup,
  type NavMenuItem,
} from './nav-menu-data';

// The Solutions and Resources menus of the nx.dev (Framer) navbar: same
// content, measurements, colors and motion. Ported from the blog header
// (nrwl/nx-blog, blog/src/components/Header.tsx). Keep them in sync. In the
// docs the nav sits on the left, so the panel opens from the "Docs" link
// rightwards, and the "Complex setup?" card only shows from 80rem.

const EASE_MENU = 'ease-[cubic-bezier(0.32,0.72,0,1)]';
const EASE_DEFAULT = 'ease-[cubic-bezier(0.25,0.1,0.25,1)]';

type Menu = 'solutions' | 'resources';

// React 18 does not know the boolean `inert` attribute yet, so set it as a
// plain string attribute.
const inert = (value: boolean): object => (value ? { inert: '' } : {});

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M9 4L15.58 10.58C16.36 11.36 16.36 12.63 15.58 13.41L9 20"
        stroke="currentColor"
      />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M20 9L13.41 15.58C12.63 16.36 11.36 16.36 10.58 15.58L4 9"
        stroke="currentColor"
      />
    </svg>
  );
}

function MenuItem({ item }: { item: NavMenuItem }) {
  return (
    <a
      href={item.href}
      {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="group/item flex h-10 w-full items-center gap-2 no-underline"
    >
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-[4px] bg-[#28282A] text-[#E5E5E6] transition-colors duration-200 ${EASE_DEFAULT} group-hover/item:bg-[#404044]`}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {item.icon}
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex h-[21px] items-center">
          <span className="text-[14px] leading-[21px] font-medium tracking-[-0.28px] text-[#FAFAFA]">
            {item.title}
          </span>
          <ChevronRight
            className={`h-[14px] w-[14px] text-[#A3A3A8] opacity-0 transition-[opacity,translate] duration-200 ${EASE_DEFAULT} group-hover/item:translate-x-1 group-hover/item:opacity-100`}
          />
        </span>
        <span className="text-[12px] leading-[18px] text-[#A3A3A8]">
          {item.description}
        </span>
      </span>
    </a>
  );
}

function MenuGroup({
  group,
  gap,
  className,
  keepEmptyLabel = true,
}: {
  group: NavMenuGroup;
  gap: string;
  className: string;
  keepEmptyLabel?: boolean;
}) {
  return (
    <div className={`flex flex-col ${gap} ${className}`}>
      {group.label ? (
        <p className="text-[12px] leading-[15px] text-[#A3A3A8]">
          {group.label}
        </p>
      ) : keepEmptyLabel ? (
        <div className="h-[15px]" />
      ) : null}
      <div className="flex flex-col gap-3">
        {group.items.map((item) => (
          <MenuItem key={item.title} item={item} />
        ))}
      </div>
    </div>
  );
}

function ComplexSetupCard({ active }: { active: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="https://nx.dev/contact/labs"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className="group/card relative hidden h-[231px] w-[318px] flex-none flex-col justify-end gap-1 overflow-hidden rounded-[8px] bg-[#28282A] p-5 no-underline transition-colors duration-200 ease-[cubic-bezier(0,0,0.58,1)] hover:bg-[#2E2E30] min-[80rem]:flex"
    >
      <div className="absolute inset-0">
        <ComplexSetupIllustration organized={hovered} active={active} />
      </div>
      <div className="relative flex items-center gap-0 transition-[gap] duration-200 ease-[cubic-bezier(0,0,0.58,1)] group-hover/card:gap-[2px]">
        <p className="text-[14px] leading-[21px] font-medium tracking-[-0.02em] text-[#FAFAFA]">
          Complex setup?
        </p>
        <ChevronRight className="h-4 w-4 text-[#FAFAFA] opacity-0 transition-opacity duration-200 ease-[cubic-bezier(0,0,0.58,1)] group-hover/card:opacity-100" />
      </div>
      <p className="relative text-[12.4px] leading-[1.3] text-[#A3A3A8]">
        From expert training to hands-on engineering support, we meet teams
        where they are and help them move forward with confidence.
      </p>
    </a>
  );
}

function PanelCaret({ className }: { className: string }) {
  const gradientId = `nav-caret-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      className={className}
      viewBox="0 0 11.149 6.935"
      preserveAspectRatio="none"
      fill="none"
      overflow="visible"
      aria-hidden="true"
    >
      <path
        fill="#19191A"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.364"
        d="M5.092.881a.683.683 0 0 1 .965 0l4.208 4.208a.682.682 0 0 1-.483 1.165H1.366a.682.682 0 0 1-.482-1.165z"
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="5.574"
          x2="5.574"
          y1="-.565"
          y2="6.253"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#28282A" />
          <stop offset=".878" stopColor="#28282A" />
          <stop offset=".884" stopColor="#28282A" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const desktopLinkClass =
  'flex items-center justify-center rounded-full bg-transparent px-4 py-2 text-[14px] font-medium leading-[1.2] text-[#D5D5D7]';

/** Desktop "Solutions" and "Resources" triggers with their shared panel. */
export function DesktopNavMenu() {
  const [open, setOpen] = useState<Menu | null>(null);
  // The panel keeps showing the last menu while it fades out.
  const [shown, setShown] = useState<Menu>('solutions');

  const show = (menu: Menu) => {
    setShown(menu);
    setOpen(menu);
  };
  const close = () => setOpen(null);

  const trigger = (menu: Menu, label: string, width: string) => (
    <button
      type="button"
      aria-expanded={open === menu}
      onPointerEnter={(e) => e.pointerType !== 'touch' && show(menu)}
      onFocus={() => show(menu)}
      onClick={() => (open === menu ? close() : show(menu))}
      className={`${desktopLinkClass} ${width} cursor-default transition-colors duration-[320ms] ${EASE_MENU} ${
        open === menu ? 'text-[#FAFAFA]' : ''
      }`}
    >
      {label}
    </button>
  );

  const content = (menu: Menu) =>
    `absolute left-0 top-0 flex gap-6 px-[25px] pb-[25px] pt-[21px] transition-opacity duration-[320ms] ${EASE_MENU} ${
      shown === menu ? 'opacity-100' : 'pointer-events-none opacity-0'
    }`;

  return (
    <div
      className="relative flex items-center gap-2"
      onPointerLeave={(e) => e.pointerType !== 'touch' && close()}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      {trigger('solutions', 'Solutions', 'w-[93px]')}
      {trigger('resources', 'Resources', 'w-[100px]')}

      <div
        {...inert(!open)}
        className={`absolute top-[26.4px] left-[-73px] flex flex-col items-start transition-[opacity,translate] duration-[320ms] max-[61.999rem]:left-[-89px] ${EASE_MENU} ${
          open
            ? 'translate-y-[6px] opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        {/* Bridges the gap between the triggers and the panel for the pointer */}
        <div className="h-7 w-px" />
        <div className="relative">
          <div
            className={`relative overflow-hidden rounded-[12px] bg-[#19191A] transition-[width,height] duration-[320ms] ${EASE_MENU} after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-[#28282A] ${
              shown === 'solutions'
                ? 'h-[277px] w-[726px] min-[80rem]:w-[1068px]'
                : 'h-[269px] w-[726px]'
            }`}
          >
            <div
              {...inert(shown !== 'solutions')}
              className={content('solutions')}
            >
              {solutionsGroups.map((group) => (
                <MenuGroup
                  key={group.label}
                  group={group}
                  gap="gap-5"
                  className="w-[326px] flex-none"
                />
              ))}
              <ComplexSetupCard active={open === 'solutions'} />
            </div>
            <div
              {...inert(shown !== 'resources')}
              className={content('resources')}
            >
              {resourcesGroups.map((group) => (
                <MenuGroup
                  key={group.label}
                  group={group}
                  gap="gap-3"
                  className="w-[326px] flex-none"
                />
              ))}
            </div>
          </div>
          <PanelCaret
            className={`absolute top-[-5px] h-2 w-[13px] transition-[left] duration-[320ms] ${EASE_MENU} ${
              shown === 'solutions'
                ? 'left-[113px] max-[61.999rem]:left-[129px]'
                : 'left-[217px] max-[61.999rem]:left-[233px]'
            }`}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * "Solutions" or "Resources" as an accordion for the phone menu. Rendered
 * without client-side JavaScript, so it relies on `<details>`.
 */
export function MobileNavMenu({ menu }: { menu: Menu }) {
  const groups = menu === 'solutions' ? solutionsGroups : resourcesGroups;
  return (
    <details className="group/menu">
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-[16px] leading-[1.2] font-medium text-[#D5D5D7] [&::-webkit-details-marker]:hidden">
        {menu === 'solutions' ? 'Solutions' : 'Resources'}
        <ChevronDown
          className={`h-4 w-4 text-[#A3A3A8] transition-transform duration-300 ${EASE_MENU} group-open/menu:rotate-180`}
        />
      </summary>
      <div className="flex flex-col gap-5 pt-1 pb-4">
        {groups.map((group) => (
          <MenuGroup
            key={group.label}
            group={group}
            gap={menu === 'solutions' ? 'gap-5' : 'gap-3'}
            className="w-full"
            keepEmptyLabel={false}
          />
        ))}
      </div>
    </details>
  );
}
