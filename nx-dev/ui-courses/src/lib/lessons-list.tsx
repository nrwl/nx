import { Course, Lesson } from '@nx/nx-dev/data-access-courses';
import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';

export function LessonsList({
  course,
  lesson,
}: {
  course: Course;
  lesson?: Lesson;
}) {
  return (
    <nav className="toc">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Contents
        </h3>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{course.lessons.length} Lessons</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="flex items-center gap-1">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {course.totalDuration}
          </span>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700/50 dark:bg-slate-900">
        <ul className="flex flex-col space-y-3">
          {course.lessons.map((courseLesson, index) => (
            <li key={courseLesson.id}>
              <Link
                href={`/courses/${course.id}/${courseLesson.id}`}
                className={cx('group flex transition', {
                  'text-slate-900 dark:text-slate-100':
                    lesson && courseLesson.id === lesson.id,
                  'text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200':
                    !(lesson && courseLesson.id === lesson.id),
                })}
                prefetch={false}
              >
                <span className="inline-block min-w-[2rem] flex-shrink-0 text-sm font-medium text-slate-400 dark:text-slate-600">
                  {(index + 1).toString().padStart(1, '0')}
                </span>
                <span className="text-[15px] font-medium leading-normal">
                  {courseLesson.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
