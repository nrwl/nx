import { BlogPostDataEntry } from './blog.model';

export interface WebinarDataEntry extends BlogPostDataEntry {
  status?: 'Upcoming' | 'Past - Gated' | 'Past - Ungated';
  eventDate?: string;
  time?: string;
  registrationUrl?: string;
}
