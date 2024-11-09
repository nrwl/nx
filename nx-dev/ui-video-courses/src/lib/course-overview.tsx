import Link from 'next/link';
import { Course } from '@nx/nx-dev/data-access-courses';
import { cx } from '@nx/nx-dev/ui-primitives';
import { ClockIcon } from '@heroicons/react/24/outline';

interface CourseOverviewProps {
  courses: Course[];
}

export function CourseOverview({ courses }: CourseOverviewProps): JSX.Element {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl lg:max-w-none">
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="block h-full transform-gpu"
              prefetch={false}
            >
              <div
                className={cx(
                  'group relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-8',
                  'dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:shadow-blue-900/20',
                  'before:absolute before:inset-0 before:z-0 before:bg-gradient-to-br before:from-blue-50 before:to-transparent before:opacity-0 before:transition-opacity',
                  'transition-all duration-300 ease-out',
                  'hover:-translate-y-2 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/50',
                  'hover:before:opacity-100 dark:before:from-blue-950'
                )}
              >
                <div className="relative z-10">
                  <p className="text-2xl font-semibold text-slate-900 transition-colors duration-200 dark:text-slate-100">
                    {course.title}
                  </p>

                  <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-400 dark:text-slate-500">
                    {course.authors?.[0]?.name && (
                      <>
                        <span>{course.authors[0].name}</span>
                        <span className="text-slate-300 dark:text-slate-600">
                          •
                        </span>
                      </>
                    )}
                    <span>{course.lessons.length} lessons</span>
                    <span className="text-slate-300 dark:text-slate-600">
                      •
                    </span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {course.totalDuration}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[15px] leading-relaxed text-slate-600 transition-colors duration-200 dark:text-slate-400">
                      {course.description}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
