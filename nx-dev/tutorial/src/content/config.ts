import { chapterSchema, lessonSchema, partSchema, tutorialSchema } from '@tutorialkit/types';
import { defineCollection } from 'astro:content';

const tutorial = defineCollection({
  type: 'content',
  schema: tutorialSchema.strict().or(partSchema.strict()).or(chapterSchema.strict()).or(lessonSchema.strict()),
});

export const collections = { tutorial };
