export interface DocumentData {
  filePath: string;
  data: { [key: string]: any };
  content: string;
  relatedContent: string;
  tags: string[];
}

export interface DocumentMetadata {
  id: string;
  name: string;
  description: string;
  packageName: string;
  file: string;
  path: string;
  isExternal: boolean;
  itemList: DocumentMetadata[];
  tags: string[];
}
