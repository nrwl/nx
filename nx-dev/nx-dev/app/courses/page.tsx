import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { CourseOverview, CourseHero } from '@nx/nx-dev/ui-video-courses';
import { coursesApi } from '../../lib/courses.api';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nx Video Courses',
  description:
    'Master Nx with expert-led video courses from the core team. Boost your skills and productivity.',
  openGraph: {
    url: 'https://nx.dev/courses',
    title: 'Nx Video Courses',
    description:
      'Master Nx with expert-led video courses from the core team. Boost your skills and productivity.',
    images: [
      {
        url: 'https://nx.dev/socials/nx-courses-media.png',
        width: 800,
        height: 421,
        alt: 'Nx Video Courses',
        type: 'image/jpeg',
      },
    ],
    siteName: 'Nx',
    type: 'website',
  },
};

export default async function CoursesPage(): Promise<JSX.Element> {
  const courses = await coursesApi.getAllCourses();

  return (
    <DefaultLayout>
      <CourseHero />
      <div className="mt-8">
        <CourseOverview courses={courses} />
      </div>
    </DefaultLayout>
  );
}
