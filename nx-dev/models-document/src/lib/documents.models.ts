export interface DocumentData {
  filePath: string;
  data: { [key: string]: any };
  content: string;
  excerpt?: string;
}

export interface DocumentMetadata {
  id: string;
  name?: string;
  file?: string;
  path?: string;
  itemList?: DocumentMetadata[];
}
