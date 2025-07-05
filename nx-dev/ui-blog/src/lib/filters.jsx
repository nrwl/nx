'use client';
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.Filters = Filters;
const tslib_1 = require('tslib');
const link_1 = tslib_1.__importDefault(require('next/link'));
const react_1 = require('react');
const navigation_1 = require('next/navigation');
const outline_1 = require('@heroicons/react/24/outline');
const react_2 = require('@headlessui/react');
const nx_dev_ui_primitives_1 = require('@nx/nx-dev-ui-primitives');
function Filters({
  blogs,
  setFilteredList,
  setSelectedFilterHeading,
  initialSelectedFilter,
  filters,
}) {
  const pathname = (0, navigation_1.usePathname)();
  const searchParams = (0, navigation_1.useSearchParams)();
  const [selectedFilter, setSelectedFilter] = (0, react_1.useState)(
    initialSelectedFilter
  );
  (0, react_1.useEffect)(() => {
    const filterBy = searchParams.get('filterBy');
    if (filterBy) {
      filterBlogs(filterBy);
      setSelectedFilter(filterBy);
    } else {
      setFilteredList(blogs);
      setSelectedFilter('All');
    }
  }, [searchParams]);
  const filterBlogs = (filter) => {
    if (filter === 'All') {
      setFilteredList(blogs);
    } else {
      setFilteredList(
        blogs.filter((blog) => blog.tags.includes(filter.toLowerCase()))
      );
    }
  };
  const updateFilter = (filterBy) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filterBy) {
      params.set('filterBy', filterBy);
    } else {
      params.delete('filterBy');
    }
    return `${pathname}${filterBy === 'All' ? '' : '?' + params.toString()}`;
  };
  return (
    <>
      {/* DESKTOP */}
      <ul className="hidden gap-2 lg:flex" aria-label="Filter blog posts">
        {filters.map((filter) => (
          <li key={filter.value}>
            <link_1.default
              href={updateFilter(filter.value)}
              aria-label={`Filter by ${filter.label}`}
              aria-current={
                filter.value === selectedFilter ? 'page' : undefined
              }
              scroll={false}
              prefetch={false}
              className={(0, nx_dev_ui_primitives_1.cx)(
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
              {filter.icon && (
                <filter.icon className="h-5 w-5" aria-hidden="true" />
              )}
              {filter.label}
            </link_1.default>
          </li>
        ))}
      </ul>

      {/* MOBILE */}
      <div className="relative lg:hidden">
        <react_2.Menu as="div" className="inline-block text-left">
          <react_2.MenuButton
            className="inline-flex w-full justify-center rounded-md border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Select filter topic"
          >
            Topics
            <outline_1.ChevronDownIcon
              className="-mr-1 ml-2 h-5 w-5 text-violet-200 hover:text-violet-100"
              aria-hidden="true"
            />
          </react_2.MenuButton>
          <react_2.Transition
            as={react_1.Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <react_2.MenuItems
              as="ul"
              className="absolute right-0 z-[31] mt-2 flex w-56 origin-top-right flex-col gap-4 rounded-md bg-white p-4 shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-slate-800 dark:text-white"
              aria-label="Filter topics"
            >
              {filters.map((filter) => (
                <react_2.MenuItem
                  as="li"
                  className="text-lg"
                  key={filter.value}
                >
                  <link_1.default
                    className={(0, nx_dev_ui_primitives_1.cx)(
                      'flex items-center gap-2'
                    )}
                    href={updateFilter(filter.value)}
                    onClick={() => setSelectedFilterHeading(filter.heading)}
                    prefetch={false}
                    scroll={false}
                    aria-label={`Filter by ${filter.label}`}
                  >
                    {filter.icon && (
                      <filter.icon className="h-5 w-5" aria-hidden="true" />
                    )}
                    {filter.label}
                  </link_1.default>
                </react_2.MenuItem>
              ))}
            </react_2.MenuItems>
          </react_2.Transition>
        </react_2.Menu>
      </div>
    </>
  );
}
