'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Course, Lesson } from '@nx/nx-dev/data-access-courses';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { YouTube } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { Header } from '@nx/nx-dev/ui-common';

interface LessonPlayerProps {
  course: Course;
  lesson: Lesson;
}

function formatDuration(duration: string): string {
  const [minutes, seconds] = duration.split(':').map(Number);
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

const LessonsList = ({
  course,
  lesson,
}: {
  course: Course;
  lesson: Lesson;
}) => (
  <ul className="space-y-2">
    {course.lessons.map((item, index) => (
      <li key={item.id}>
        <Link
          href={`/courses/${course.id}/${item.id}`}
          className={cx(
            'flex w-full items-center px-3 py-2 transition-colors',
            {
              'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100':
                item.id === lesson.id,
              'hover:bg-slate-100 dark:hover:bg-slate-800':
                item.id !== lesson.id,
            }
          )}
          prefetch={false}
        >
          <span
            className={cx('inline-block min-w-[2rem] flex-shrink-0 text-sm', {
              'text-blue-600 dark:text-blue-400': item.id === lesson.id,
              'text-slate-400 dark:text-slate-500': item.id !== lesson.id,
            })}
          >
            {(index + 1).toString()}
          </span>
          <span className="flex-1 text-sm leading-normal">
            <span
              className={cx('', {
                'font-semibold': item.id === lesson.id,
                'text-slate-700 dark:text-slate-300': item.id !== lesson.id,
              })}
            >
              {item.title}
            </span>
          </span>
          {item.duration && (
            <span className="ml-2 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
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
              {formatDuration(item.duration)}
            </span>
          )}
        </Link>
      </li>
    ))}
  </ul>
);

export function LessonPlayer({ course, lesson }: LessonPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { node: lessonContent } = renderMarkdown(lesson.description, {
    filePath: lesson.filePath,
    headingClass: 'scroll-mt-20',
  });

  return (
    <>
      <Header />
      <div className="flex h-screen w-full pt-20">
        {/* Left Panel - Course Info & Lessons (Hidden on mobile) */}
        <div className="hidden lg:flex lg:w-80 lg:flex-none lg:flex-col lg:border-r lg:border-slate-200 lg:dark:border-slate-700">
          <div className="border-b border-slate-200 p-6 dark:border-slate-700">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Course by {course.authors[0].name}
            </div>
            <Link
              href={`/courses/${course.id}`}
              className="mt-1 block text-xl font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
            >
              {course.title}
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <LessonsList course={course} lesson={lesson} />
          </div>
        </div>

        {/* Center/Right Panel - Video & Content */}
        <div className="wide:w-[45%] wide:flex-none wide:overflow-y-visible wide:border-r wide:border-slate-200 wide:dark:border-slate-700 flex flex-1 flex-col overflow-y-auto">
          {/* Video Section */}
          <div className="flex-none border-b border-slate-200 dark:border-slate-700">
            {lesson.videoUrl ? (
              <div className="aspect-video">
                <YouTube
                  src={lesson.videoUrl}
                  title={lesson.title}
                  width="100%"
                  disableRoundedCorners
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-slate-100 dark:bg-slate-800">
                <p className="text-slate-500 dark:text-slate-400">
                  No video available for this lesson
                </p>
              </div>
            )}
          </div>

          {/* Mobile Course Title and Lessons List */}
          <div className="flex-none border-b border-slate-200 lg:hidden dark:border-slate-700">
            <div className="p-4">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Course by {course.authors[0].name}
              </div>
              <div className="flex items-center justify-between">
                <Link
                  href={`/courses/${course.id}`}
                  className="mt-1 block text-xl font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                >
                  {course.title}
                </Link>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {isExpanded ? 'Hide' : 'Show'} lessons
                  <svg
                    className={cx(
                      'ml-1 h-4 w-4 transform transition-transform',
                      {
                        'rotate-180': isExpanded,
                      }
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <LessonsList />
              </div>
            )}
          </div>

          {/* Content Section (Hidden on wide screens) */}
          <div className="wide:hidden flex-1">
            <div className="mx-auto max-w-4xl px-8 py-6">
              <h1 className="mb-6 text-3xl font-bold text-slate-900 dark:text-white">
                {lesson.title}
              </h1>
              <div className="prose prose-slate prose-lg dark:prose-invert max-w-none">
                {lessonContent}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Lesson Content (wide screens Only) */}
        <div className="wide:block wide:flex-1 wide:overflow-y-auto hidden">
          <div className="mx-auto max-w-3xl px-8 py-6">
            <h1 className="mb-6 text-3xl font-bold text-slate-900 dark:text-white">
              {lesson.title}
            </h1>
            <div className="prose prose-slate prose-lg dark:prose-invert max-w-none">
              {lessonContent}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
