export interface Resource {
  id: string;
  title: string;
  description?: string;
  category: 'whitepaper' | 'book' | 'case-study' | 'cheatsheet';
  coverImage: string;
  downloadUrl: string;
  fileSize?: string;
  publishDate?: string;
}
