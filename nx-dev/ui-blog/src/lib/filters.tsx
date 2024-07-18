'use client';
import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ComputerDesktopIcon,
  BookOpenIcon,
  MicrophoneIcon,
  CubeIcon,
  AcademicCapIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ChevronDownIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { Menu, Transition } from '@headlessui/react';
import { cx } from '@nx/nx-dev/ui-primitives';
import { BlogPostDataEntry } from '@nx/nx-dev/data-access-documents/node-only';

export interface FiltersProps {
  blogs: BlogPostDataEntry[];
  setFilteredList: (blogs: BlogPostDataEntry[]) => void;
  setSelectedFilterHeading: (heading: string) => void;
}

const filters = [
  {
    label: 'All',
    icon: ListBulletIcon,
    value: 'All',
    heading: 'All Blogs',
  },
  {
    label: 'Stories',
    icon: BookOpenIcon,
    value: 'customer story',
    heading: 'Customer Stories',
  },
  {
    label: 'Webinars',
    icon: ComputerDesktopIcon,
    value: 'webinar',
    heading: 'Webinars',
  },
  {
    label: 'Podcasts',
    icon: MicrophoneIcon,
    value: 'podcast',
    heading: 'Podcasts',
  },
  {
    label: 'Releases',
    icon: CubeIcon,
    value: 'release',
    heading: 'Release Blogs',
  },
  {
    label: 'Talks',
    icon: ChatBubbleOvalLeftEllipsisIcon,
    value: 'talk',
    heading: 'Talks',
  },
  {
    label: 'Tutorials',
    icon: AcademicCapIcon,
    value: 'tutorial',
    heading: 'Tutorials',
  },
];

export function Filters({
  blogs,
  setFilteredList,
  setSelectedFilterHeading,
}: FiltersProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedFilter, setSelectedFilter] = useState('All');

  useEffect(() => {
    const filterBy = searchParams.get('filterBy');
    if (filterBy) {
      filterBlogs(filterBy);
      setSelectedFilter(filterBy);
    } else {
      setFilteredList(blogs);
      setSelectedFilter('All');
    }
  }, [searchParams]);

  const filterBlogs = (filter: string) => {
    if (filter === 'All') {
      setFilteredList(blogs);
    } else {
      setFilteredList(
        blogs.filter((blog) => blog.tags.includes(filter.toLowerCase()))
      );
    }
  };

  const updateFilter = (filterBy: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filterBy) {
      params.set('filterBy', filterBy);
    } else {
      params.delete('filterBy');
    }
    return params.toString();
  };

  return (
    <>
      {/* DESKTOP */}
      <ul className="hidden gap-2 lg:flex">
        {filters.map((filter) => (
          <li key={filter.value}>
            <Link
              href={pathname + '?' + updateFilter(filter.value)}
              title={'Filter by ' + filter.value}
              scroll={false}
              prefetch={false}
              className={cx(
                'flex items-center justify-center gap-2 rounded-full bg-white px-3 py-2 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
                {
                  'ring-2 ring-slate-500 ring-offset-1 ring-offset-transparent dark:ring-slate-600':
                    filter.value === selectedFilter,
                },
                {
                  'border border-slate-400 dark:border-slate-700':
                    filter.value !== selectedFilter,
                }
              )}
              onClick={() => setSelectedFilterHeading(filter.heading)}
            >
              {filter.icon && <filter.icon className="h-5 w-5" />}
              {filter.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* MOBILE */}
      <div className="relative lg:hidden">
        <Menu as="div" className="inline-block text-left">
          <Menu.Button className="inline-flex w-full justify-center rounded-md border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            Filters
            <ChevronDownIcon
              className="-mr-1 ml-2 h-5 w-5 text-violet-200 hover:text-violet-100"
              aria-hidden="true"
            />
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items
              as="ul"
              className="absolute right-0 z-[31] mt-2 flex w-56 origin-top-right flex-col gap-4 rounded-md bg-white p-4 shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-slate-800 dark:text-white"
            >
              {filters.map((filter) => (
                <Menu.Item as="li" className="text-lg" key={filter.value}>
                  <Link
                    className={cx('flex items-center gap-2')}
                    href={pathname + '?' + updateFilter(filter.value)}
                    onClick={() => setSelectedFilterHeading(filter.heading)}
                    prefetch={false}
                    scroll={false}
                  >
                    {filter.icon && <filter.icon className="h-5 w-5" />}
                    {filter.label}
                  </Link>
                </Menu.Item>
              ))}
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </>
  );
}
