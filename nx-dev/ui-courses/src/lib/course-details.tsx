import { Course } from '@nx/nx-dev/data-access-courses';
import { ButtonLink } from '@nx/nx-dev/ui-common';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import Link from 'next/link';
import { BlogAuthors } from '@nx/nx-dev/ui-blog';
import type { BlogAuthor } from '@nx/nx-dev/data-access-documents/node-only';
import { LessonsList } from './lessons-list';
import { GitHubIcon, GithubIcon } from '@nx/nx-dev/ui-icons';

export interface CourseDetailsProps {
  course: Course;
}

export function CourseDetails({ course }: CourseDetailsProps) {
  const { node } = renderMarkdown(course.content, {
    filePath: course.filePath ?? '',
    headingClass: 'scroll-mt-20',
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/courses"
          className="group inline-flex items-center text-sm leading-6 text-slate-950 dark:text-white"
          prefetch={false}
        >
          <span
            aria-hidden="true"
            className="mr-1 inline-block transition group-hover:-translate-x-1"
          >
            ←
          </span>
          All courses
        </Link>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <div className="course-title-section">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
            {course.title}
          </h1>
          <div className="mt-4 flex items-center gap-x-2">
            <BlogAuthors authors={course.authors as BlogAuthor[]} />
            <span className="text-sm">{course.authors[0].name}</span>
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center gap-x-6">
        {course.lessons && course.lessons.length > 0 && (
          <ButtonLink
            href={`/courses/${course.id}/${course.lessons[0].id}`}
            title="Start the course"
            variant="primary"
            size="default"
          >
            Start Learning
          </ButtonLink>
        )}
        {course.repository && (
          <ButtonLink
            href={course.repository}
            title="Code"
            variant="contrast"
            size="default"
          >
            <GitHubIcon className="mr-2 inline-block h-5 w-5" />
            Code
          </ButtonLink>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-8 md:flex-row">
        <div className="course-description md:w-2/3">
          <div className="prose prose-lg prose-slate dark:prose-invert w-full max-w-none 2xl:max-w-4xl">
            {node}
          </div>
        </div>

        {course.lessons && course.lessons.length > 0 && (
          <div className="course-lessons md:w-1/3">
            <LessonsList course={course} />
          </div>
        )}
      </div>
    </div>
  );
}
