import { RelatedDocumentsCategory } from '@nx/nx-dev/models-document';
import {
  CubeTransparentIcon,
  ArrowRightIcon,
  ClipboardDocumentIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

export function RelatedDocumentsSection({
  relatedCategories,
}: {
  relatedCategories: RelatedDocumentsCategory[];
}) {
  return (
    <div className="grid  grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {relatedCategories.length > 0 &&
        relatedCategories.map((category) => (
          <CategoryBox key={category.id} category={category} />
        ))}
    </div>
  );
}

const iconMap: { [key: string]: JSX.Element } = {
  concepts: <CubeTransparentIcon className="mr-2 h-6 w-6" aria-hidden="true" />,
  recipes: (
    <ClipboardDocumentIcon className="mr-2 h-6 w-6" aria-hidden="true" />
  ),
  reference: <LightBulbIcon className="mr-2 h-6 w-6" aria-hidden="true" />,
  'see-also': (
    <MagnifyingGlassIcon className="mr-2 h-6 w-6" aria-hidden="true" />
  ),
  default: (
    <InformationCircleIcon className="mr-2 h-6 w-6" aria-hidden="true" />
  ),
};

function CategoryBox({ category }: { category: RelatedDocumentsCategory }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/60 p-5 dark:border-slate-800/40 dark:bg-slate-800/60">
      <h4 className="mt-0 flex items-center pb-2 text-xl font-bold">
        {iconMap[category.id] ?? iconMap.default}
        {category.name}
      </h4>
      <ul className="list-none divide-y divide-slate-300 pl-0 dark:divide-slate-700">
        {category.relatedDocuments.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between py-1 pl-0 text-sm"
          >
            <Link
              href={d.path}
              className="flex flex-grow items-center justify-between no-underline hover:text-sky-600 hover:underline dark:hover:text-sky-400"
              prefetch={false}
            >
              <span>{d.name}</span>
              <ArrowRightIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
