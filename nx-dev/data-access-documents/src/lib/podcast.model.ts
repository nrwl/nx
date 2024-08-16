import { BlogPostDataEntry } from './blog.model';

export interface PodcastDataEntry extends BlogPostDataEntry {
  duration?: string;
}
