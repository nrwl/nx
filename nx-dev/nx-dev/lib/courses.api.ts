import { CoursesApi } from '@nx/nx-dev-data-access-courses';
import { join } from 'path';

const coursesRoot = join(process.cwd(), 'courses-content');

export const coursesApi = new CoursesApi({
  coursesRoot,
  authorsPath: join(coursesRoot, 'authors.json'),
});
