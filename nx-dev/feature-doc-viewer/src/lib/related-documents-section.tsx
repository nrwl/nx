import { RelatedDocumentsCategory } from '@nx/nx-dev/models-document';
import {
  CubeTransparentIcon,
  ArrowRightIcon,
  ClipboardDocumentIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

export function RelatedDocumentsSection({
  relatedCategories,
}: {
  relatedCategories: RelatedDocumentsCategory[];
}) {
  return (
    <div className="grid  lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3 items-stretch">
      {relatedCategories.length > 0 &&
        relatedCategories.map((category) => (
          <CategoryBox key={category.id} category={category} />
        ))}
    </div>
  );
}

const iconMap: { [key: string]: JSX.Element } = {
  concepts: <CubeTransparentIcon className="w-6 h-6 mr-2" aria-hidden="true" />,
  recipes: (
    <ClipboardDocumentIcon className="w-6 h-6 mr-2" aria-hidden="true" />
  ),
  reference: <LightBulbIcon className="w-6 h-6 mr-2" aria-hidden="true" />,
  'see-also': (
    <MagnifyingGlassIcon className="w-6 h-6 mr-2" aria-hidden="true" />
  ),
  default: (
    <InformationCircleIcon className="w-6 h-6 mr-2" aria-hidden="true" />
  ),
};

function CategoryBox({ category }: { category: RelatedDocumentsCategory }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/60 p-5 dark:border-slate-800/40 dark:bg-slate-800/60">
      <h4 className="flex items-center mt-0 pb-2 text-xl font-bold">
        {iconMap[category.id] ?? iconMap.default}
        {category.name}
      </h4>
      <ul className="divide-y divide-slate-300 dark:divide-slate-700 list-none pl-0">
        {category.relatedDocuments.map((d) => (
          <li
            key={d.id}
            className="flex justify-between items-center py-1 pl-0 text-sm"
          >
            <a
              href={d.path}
              className="no-underline hover:underline hover:text-sky-600 dark:hover:text-sky-400 flex-grow flex justify-between items-center"
            >
              <span>{d.name}</span>
              <ArrowRightIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
