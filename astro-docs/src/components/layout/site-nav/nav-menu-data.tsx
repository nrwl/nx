import type { ReactNode } from 'react';

// Menu content mirrors the nx.dev (Framer) navbar, as ported for the blog in
// nrwl/nx-blog (blog/src/components/nav-menu-data.tsx). Keep them in sync.
export interface NavMenuItem {
  title: string;
  description: string;
  href: string;
  external?: boolean;
  icon: ReactNode;
}

export interface NavMenuGroup {
  // Empty label keeps the column aligned with its labelled neighbour.
  label: string;
  items: NavMenuItem[];
}

export const solutionsGroups: NavMenuGroup[] = [
  {
    label: 'Role',
    items: [
      {
        title: 'Developers',
        description: 'From your editor to CI, without the wait',
        href: 'https://nx.dev/solutions/engineering',
        icon: (
          <>
            <path
              d="M17.25 7.75L20.60 11.31C20.96 11.69 20.96 12.30 20.60 12.68L17.25 16.25"
              stroke="currentColor"
            />
            <path
              d="M6.75 16.25L3.39 12.68C3.03 12.30 3.03 11.69 3.39 11.31L6.75 7.75"
              stroke="currentColor"
            />
          </>
        ),
      },
      {
        title: 'Platform & DevOps',
        description: "CI you don't have to build or maintain yourself",
        href: 'https://nx.dev/solutions/platform',
        icon: (
          <>
            <path
              d="M7.79 12L3.30 14.23C2.56 14.60 2.56 15.67 3.30 16.04L11.55 20.14C11.83 20.28 12.16 20.28 12.44 20.14L20.69 16.04C21.43 15.67 21.43 14.60 20.69 14.23L16.20 12M16.20 12L12.44 13.87C12.16 14.01 11.83 14.01 11.55 13.87L7.79 12L3.30 9.76C2.56 9.39 2.56 8.32 3.30 7.95L11.55 3.85C11.83 3.71 12.16 3.71 12.44 3.85L20.69 7.95C21.43 8.32 21.43 9.39 20.69 9.76L16.20 12Z"
              stroke="currentColor"
              strokeLinecap="square"
            />
          </>
        ),
      },
      {
        title: 'Engineering managers',
        description: 'Shorter PR cycles and more predictable delivery',
        href: 'https://nx.dev/solutions/management',
        icon: (
          <>
            <path
              d="M18 21C19.65 21 21 19.65 21 18C21 16.34 19.65 15 18 15C16.34 15 15 16.34 15 18C15 19.65 16.34 21 18 21Z"
              stroke="currentColor"
            />
            <path
              d="M6 9C7.65 9 9 7.65 9 6C9 4.34 7.65 3 6 3C4.34 3 3 4.34 3 6C3 7.65 4.34 9 6 9Z"
              stroke="currentColor"
            />
            <path d="M6 20.5V9" stroke="currentColor" />
            <path d="M6 9C6 13.97 10.02 18 15 18" stroke="currentColor" />
          </>
        ),
      },
      {
        title: 'CTOs & VPs of engineering',
        description: 'Lower CI costs as your organization scales',
        href: 'https://nx.dev/solutions/leadership',
        icon: (
          <>
            <path d="M10.25 8.75H7.75" stroke="currentColor" />
            <path d="M7.75 12.75H10.25" stroke="currentColor" />
            <path d="M22.25 19.25H1.75" stroke="currentColor" />
            <path
              d="M3.75 19.25V5.75C3.75 4.64 4.64 3.75 5.75 3.75H12.25C13.35 3.75 14.25 4.64 14.25 5.75V19.25"
              stroke="currentColor"
            />
            <path
              d="M14.25 7.75H18.25C19.35 7.75 20.25 8.64 20.25 9.75V19.25"
              stroke="currentColor"
            />
          </>
        ),
      },
    ],
  },
  {
    label: 'Enterprise',
    items: [
      {
        title: 'Nx Cloud for Enterprises',
        description: 'Dedicated support and custom deployment',
        href: 'https://nx.dev/enterprise',
        icon: (
          <>
            <path
              d="M21.25 18.25V8.75C21.25 7.64 20.35 6.75 19.25 6.75H4.75C3.64 6.75 2.75 7.64 2.75 8.75V18.25C2.75 19.35 3.64 20.25 4.75 20.25H19.25C20.35 20.25 21.25 19.35 21.25 18.25Z"
              stroke="currentColor"
            />
            <path
              d="M7.75 6.75V4.75C7.75 3.64 8.64 2.75 9.75 2.75H14.25C15.35 2.75 16.25 3.64 16.25 4.75V6.75"
              stroke="currentColor"
            />
          </>
        ),
      },
      {
        title: 'Security',
        description: 'How Nx Cloud handles your code and data',
        href: 'https://nx.dev/enterprise/security',
        icon: (
          <>
            <path
              d="M3.75 7.07C3.75 6.27 4.22 5.54 4.96 5.23L11.21 2.58C11.71 2.36 12.28 2.36 12.78 2.58L19.03 5.23C19.77 5.54 20.25 6.27 20.25 7.07V13C20.25 17.55 16.55 21.25 12 21.25C7.44 21.25 3.75 17.55 3.75 13V7.07Z"
              stroke="currentColor"
            />
          </>
        ),
      },
      {
        title: 'Customer stories',
        description: 'How teams at Fortune 500 companies use Nx',
        href: 'https://nx.dev/customer-stories',
        icon: (
          <>
            <path
              d="M13.77 14.60C13.77 12.59 15.44 10.95 17.51 10.95C19.57 10.95 21.25 12.59 21.25 14.60C21.25 16.61 19.57 18.25 17.51 18.25C15.44 18.25 13.77 16.61 13.77 14.60ZM13.77 14.60C13.50 9.65 15.90 7.83 19.11 5.75"
              stroke="currentColor"
            />
            <path
              d="M2.77 14.60C2.77 12.59 4.44 10.95 6.51 10.95C8.57 10.95 10.25 12.59 10.25 14.60C10.25 16.61 8.57 18.25 6.51 18.25C4.44 18.25 2.77 16.61 2.77 14.60ZM2.77 14.60C2.50 9.65 4.90 7.83 8.11 5.75"
              stroke="currentColor"
            />
            <path
              d="M13.77 14.60C13.77 12.59 15.44 10.95 17.51 10.95C19.57 10.95 21.25 12.59 21.25 14.60C21.25 16.61 19.57 18.25 17.51 18.25C15.44 18.25 13.77 16.61 13.77 14.60ZM13.77 14.60C13.50 9.65 15.90 7.83 19.11 5.75M2.77 14.60C2.77 12.59 4.44 10.95 6.51 10.95C8.57 10.95 10.25 12.59 10.25 14.60C10.25 16.61 8.57 18.25 6.51 18.25C4.44 18.25 2.77 16.61 2.77 14.60ZM2.77 14.60C2.50 9.65 4.90 7.83 8.11 5.75"
              stroke="currentColor"
            />
          </>
        ),
      },
      {
        title: 'Nx Labs',
        description: 'Training and hands-on help from the Nx team',
        href: 'https://nx.dev/contact/labs',
        icon: (
          <>
            <path
              d="M8.75 11V6.75H15.25V11C16.42 12.47 18.30 14.11 19 16.07C19.15 16.50 19.25 16.95 19.25 17.41C19.25 19.53 17.53 21.25 15.41 21.25H8.58C6.46 21.25 4.75 19.53 4.75 17.41C4.75 16.95 4.84 16.50 4.99 16.07C5.69 14.11 7.57 12.47 8.75 11Z"
              stroke="currentColor"
            />
            <path d="M8.75 6.75H7.75" stroke="currentColor" />
            <path
              d="M4.99 16.07C4.99 16.07 7.67 15.50 9.41 15.55C11.47 15.60 12.52 16.53 14.58 16.58C16.32 16.63 19 16.07 19 16.07"
              stroke="currentColor"
            />
            <path d="M15.25 6.75H16.25" stroke="currentColor" />
            <path
              d="M10.25 4C10.25 4.13 10.13 4.25 10 4.25M10.25 4C10.25 3.86 10.13 3.75 10 3.75M10.25 4H10M10 4.25C9.86 4.25 9.75 4.13 9.75 4M10 4.25V4M9.75 4C9.75 3.86 9.86 3.75 10 3.75M9.75 4H10M10 3.75V4M10 4L9.82 4.17M10 4L10.17 3.82M10 4L9.82 3.82M10 4L10.17 4.17M9.82 4.17C9.92 4.27 10.07 4.27 10.17 4.17M9.82 4.17C9.72 4.07 9.72 3.92 9.82 3.82M10.17 4.17C10.27 4.07 10.27 3.92 10.17 3.82M10.17 3.82C10.07 3.72 9.92 3.72 9.82 3.82"
              stroke="currentColor"
            />
            <path
              d="M14.25 2.5C14.25 2.91 13.91 3.25 13.5 3.25C13.08 3.25 12.75 2.91 12.75 2.5C12.75 2.08 13.08 1.75 13.5 1.75C13.91 1.75 14.25 2.08 14.25 2.5Z"
              stroke="currentColor"
            />
          </>
        ),
      },
    ],
  },
];

export const resourcesGroups: NavMenuGroup[] = [
  {
    label: 'Learn',
    items: [
      {
        title: 'Blog',
        description: 'Set up Nx step by step',
        href: 'https://nx.dev/blog',
        icon: (
          <>
            <path
              d="M3.75 6.75C3.75 5.64 4.64 4.75 5.75 4.75H6.25C7.35 4.75 8.25 5.64 8.25 6.75V7.25C8.25 8.35 7.35 9.25 6.25 9.25H5.75C4.64 9.25 3.75 8.35 3.75 7.25V6.75Z"
              stroke="currentColor"
            />
            <path
              d="M3.75 16.75C3.75 15.64 4.64 14.75 5.75 14.75H6.25C7.35 14.75 8.25 15.64 8.25 16.75V17.25C8.25 18.35 7.35 19.25 6.25 19.25H5.75C4.64 19.25 3.75 18.35 3.75 17.25V16.75Z"
              stroke="currentColor"
            />
            <path d="M12.75 5.25H20.25" stroke="currentColor" />
            <path d="M12.75 8.75H17.25" stroke="currentColor" />
            <path d="M12.75 15.25H20.25" stroke="currentColor" />
            <path d="M12.75 18.75H17.25" stroke="currentColor" />
          </>
        ),
      },
      {
        title: 'Tutorials',
        description: 'Set up Nx step by step',
        href: '/docs/getting-started/tutorials',
        icon: (
          <>
            <path
              d="M12 21.25C11.69 20.64 11.22 20.12 10.64 19.77C10.07 19.41 9.40 19.25 8.72 19.25H3.25C2.42 19.25 1.75 18.57 1.75 17.75V6.25C1.75 5.42 2.42 4.75 3.25 4.75H9C10.65 4.75 12 6.09 12 7.75C12 6.09 13.34 4.75 15 4.75H20.75C21.57 4.75 22.25 5.42 22.25 6.25V17.75C22.25 18.57 21.57 19.25 20.75 19.25H15.27C14.59 19.25 13.92 19.41 13.35 19.77C12.77 20.12 12.30 20.64 12 21.25ZM12 7.75V21.25"
              stroke="currentColor"
            />
          </>
        ),
      },
      {
        title: 'Webinars',
        description: 'Sessions with the Nx team',
        href: 'https://nx.dev/webinars',
        icon: (
          <>
            <path
              d="M10.75 15.75V10.75L14 13.25L10.75 15.75Z"
              stroke="currentColor"
            />
            <path
              d="M4.75 20.25H19.25C20.35 20.25 21.25 19.35 21.25 18.25V8.25C21.25 7.14 20.35 6.25 19.25 6.25H4.75C3.64 6.25 2.75 7.14 2.75 8.25V18.25C2.75 19.35 3.64 20.25 4.75 20.25Z"
              stroke="currentColor"
            />
            <path d="M4.75 3.75H19.25" stroke="currentColor" />
            <path d="M12.25 13.25H11.5V13" stroke="currentColor" />
            <path d="M11.5 13.25V13.5" stroke="currentColor" />
          </>
        ),
      },
      {
        title: 'Monorepos',
        description: 'What are monorepos and their benefits',
        href: 'https://monorepo.tools/',
        external: true,
        icon: (
          <>
            <path
              d="M10.4 2.67C10.98 2.33 11.27 2.16 11.58 2.10C11.85 2.04 12.14 2.04 12.41 2.10C12.72 2.16 13.01 2.33 13.6 2.67L19.27 5.95C19.85 6.28 20.15 6.45 20.36 6.69C20.55 6.89 20.69 7.14 20.77 7.41C20.87 7.71 20.87 8.04 20.87 8.72V15.27C20.87 15.95 20.87 16.28 20.77 16.58C20.69 16.85 20.55 17.10 20.36 17.30C20.15 17.54 19.85 17.71 19.27 18.04L13.6 21.32C13.01 21.66 12.72 21.83 12.41 21.89C12.14 21.95 11.85 21.95 11.58 21.89C11.27 21.83 10.98 21.66 10.4 21.32L4.72 18.04C4.14 17.71 3.84 17.54 3.63 17.30C3.44 17.10 3.30 16.85 3.22 16.58C3.12 16.28 3.12 15.95 3.12 15.27V8.72C3.12 8.04 3.12 7.71 3.22 7.41C3.30 7.14 3.44 6.89 3.63 6.69C3.84 6.45 4.14 6.28 4.72 5.95L10.4 2.67Z"
              stroke="currentColor"
            />
            <path
              d="M11.99 12L3.70 7.21M11.99 12L20.29 7.21M11.99 12L12 21.54"
              stroke="currentColor"
            />
          </>
        ),
      },
    ],
  },
  {
    label: '',
    items: [
      {
        title: 'Metaharnesses',
        description: 'What are shared workflows for coding agents',
        href: 'https://metaharness.tools/',
        external: true,
        icon: (
          <>
            <circle cx="18.5" cy="7.5" r="2.5" stroke="currentColor" />
            <circle cx="5.5" cy="16.5" r="2.5" stroke="currentColor" />
            <circle cx="8.5" cy="6.5" r="3.5" stroke="currentColor" />
            <circle cx="15.5" cy="17.5" r="3.5" stroke="currentColor" />
            <path
              d="M12 6.85L16 7.25M17.75 10L16.55 14M13.5 14.35L12 12L10.40 9.50M6.25 14L7.45 10M8 16.75L12 17.15"
              stroke="currentColor"
            />
          </>
        ),
      },
      {
        title: 'Books',
        description: 'Dedicated support and custom deployment.',
        href: 'https://nx.dev/resources',
        icon: (
          <>
            <path
              d="M2.75 6.75C2.75 6.19 3.19 5.75 3.75 5.75H5.75C6.30 5.75 6.75 6.19 6.75 6.75V19.25C6.75 19.80 6.30 20.25 5.75 20.25H3.75C3.19 20.25 2.75 19.80 2.75 19.25V6.75Z"
              stroke="currentColor"
              strokeLinecap="square"
            />
            <path
              d="M14.25 8.46C14.11 7.93 14.43 7.38 14.96 7.24L17.38 6.59C17.91 6.45 18.46 6.76 18.60 7.30L21.58 18.40C21.72 18.94 21.40 19.49 20.87 19.63L18.46 20.28C17.92 20.42 17.37 20.10 17.23 19.57L14.25 8.46Z"
              stroke="currentColor"
              strokeLinecap="square"
            />
            <path
              d="M6.75 4.75C6.75 4.19 7.19 3.75 7.75 3.75H12.25C12.80 3.75 13.25 4.19 13.25 4.75V19.25C13.25 19.80 12.80 20.25 12.25 20.25H7.75C7.19 20.25 6.75 19.80 6.75 19.25V4.75Z"
              stroke="currentColor"
              strokeLinecap="square"
            />
            <path
              d="M6.75 7.87H13.25"
              stroke="currentColor"
              strokeLinecap="square"
            />
            <path
              d="M6.75 16.12H13.25"
              stroke="currentColor"
              strokeLinecap="square"
            />
          </>
        ),
      },
      {
        title: 'Whitepapers',
        description: 'How Nx Cloud handles your code and data.',
        href: 'https://nx.dev/resources',
        icon: (
          <>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M4 4.75C4 3.23 5.23 2 6.75 2H19.25C19.66 2 20 2.33 20 2.75V21.25C20 21.66 19.66 22 19.25 22H6.75C5.23 22 4 20.76 4 19.25C4 19.19 4 19.14 4 19.08C4 19.05 4 19.02 4 19V4.75ZM5.5 19.25C5.5 19.94 6.05 20.5 6.75 20.5H18.5V18H6.75C6.05 18 5.5 18.55 5.5 19.25ZM18.5 16.5H6.75C6.29 16.5 5.87 16.60 5.5 16.79V4.75C5.5 4.05 6.05 3.5 6.75 3.5H18.5V16.5Z"
              fill="currentColor"
            />
            <path
              d="M12.18 7.40C12.28 7.35 12.35 7.28 12.40 7.18L13.05 5.89C13.23 5.52 13.76 5.52 13.94 5.89L14.59 7.18C14.64 7.28 14.71 7.35 14.81 7.40L16.10 8.05C16.47 8.23 16.47 8.76 16.10 8.94L14.81 9.59C14.71 9.64 14.64 9.71 14.59 9.81L13.94 11.10C13.76 11.47 13.23 11.47 13.05 11.10L12.40 9.81C12.35 9.71 12.28 9.64 12.18 9.59L10.89 8.94C10.52 8.76 10.52 8.23 10.89 8.05L12.18 7.40Z"
              fill="currentColor"
            />
            <path
              d="M8.57 11.71C8.63 11.68 8.68 11.63 8.71 11.57L9.23 10.53C9.34 10.31 9.65 10.31 9.76 10.53L10.28 11.57C10.31 11.63 10.36 11.68 10.42 11.71L11.46 12.23C11.68 12.34 11.68 12.65 11.46 12.76L10.42 13.28C10.36 13.31 10.31 13.36 10.28 13.42L9.76 14.46C9.65 14.68 9.34 14.68 9.23 14.46L8.71 13.42C8.68 13.36 8.63 13.31 8.57 13.28L7.53 12.76C7.31 12.65 7.31 12.34 7.53 12.23L8.57 11.71Z"
              fill="currentColor"
            />
          </>
        ),
      },
    ],
  },
];
