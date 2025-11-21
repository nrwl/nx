import { Resource } from './types';
import { ResourceCard } from './resource-card';

interface ResourceGridProps {
  resources: Resource[];
}

// Define the order in which categories should be displayed
const CATEGORY_ORDER = [
  'book',
  'case-study',
  'whitepaper',
  'cheatsheet',
] as const;

// Map category values to display labels
const CATEGORY_LABELS: Record<string, string> = {
  book: 'Books',
  'case-study': 'Case Studies',
  whitepaper: 'Whitepapers',
  cheatsheet: 'Cheat Sheets',
};

function hasMultipleCategories(resources: Resource[]): boolean {
  const categories = new Set(resources.map((r) => r.category));
  return categories.size > 1;
}

function groupByCategory(resources: Resource[]): Map<string, Resource[]> {
  const grouped = new Map<string, Resource[]>();

  resources.forEach((resource) => {
    const category = resource.category;
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(resource);
  });

  return grouped;
}

function sortByPublishDate(resources: Resource[]): Resource[] {
  return [...resources].sort((a, b) => {
    const dateA = a.publishDate ? new Date(a.publishDate).getTime() : 0;
    const dateB = b.publishDate ? new Date(b.publishDate).getTime() : 0;
    return dateB - dateA; // Descending order (newest first)
  });
}

export function ResourceGrid({ resources }: ResourceGridProps) {
  const showSections = hasMultipleCategories(resources);

  if (!showSections) {
    // Single category or no grouping needed - render flat list
    const sortedResources = sortByPublishDate(resources);
    return (
      <div className="mx-auto grid auto-rows-fr grid-cols-1 gap-5 lg:grid-cols-2">
        {sortedResources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
    );
  }

  // Multiple categories - render sections with headers
  const groupedResources = groupByCategory(resources);

  return (
    <div className="space-y-12">
      {CATEGORY_ORDER.map((category) => {
        const categoryResources = groupedResources.get(category);

        if (!categoryResources || categoryResources.length === 0) {
          return null;
        }

        const sortedCategoryResources = sortByPublishDate(categoryResources);

        return (
          <section key={category}>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="mt-2 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="mx-auto grid auto-rows-fr grid-cols-1 gap-5 lg:grid-cols-2">
              {sortedCategoryResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
