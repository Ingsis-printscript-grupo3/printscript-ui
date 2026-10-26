import {Pagination} from "./pagination.ts";
import {FileType} from "../types/FileType.ts";

export type ComplianceEnum =
    'pending' |
    'failed' |
    'not-compliant' |
    'compliant'


export type CreateSnippet = {
  name: string;
  content: string;
  language: string;
  extension: string;
}

export type CreateSnippetWithLang = CreateSnippet & { language: string }

export type UpdateSnippet = {
  content: string
}

export type Snippet = CreateSnippet & {
  id: string
} & SnippetStatus

type SnippetStatus = {
  compliance: ComplianceEnum;
  author: string;
}
export type PaginatedSnippets = Pagination & {
  snippets: Snippet[]
}

const FALLBACK_FILE_TYPES: FileType[] = [
  { language: 'printscript', extension: 'ps' },
  { language: 'python', extension: 'py' },
  { language: 'java', extension: 'java' },
  { language: 'golang', extension: 'go' },
];

export const getFileLanguage = (fileTypes: FileType[], fileExt?: string): FileType | undefined => {
  if (!fileExt) return undefined;
  const cleanExt = fileExt.toLowerCase().replace(/^\./, '');
  const findMatch = (types: FileType[]) =>
    types?.find((x) => {
      const xExt = x.extension.toLowerCase().replace(/^\./, '');
      if (xExt === cleanExt) return true;
      if ((cleanExt === 'ps' || cleanExt === 'prs') && (xExt === 'ps' || xExt === 'prs')) return true;
      return false;
    });

  return findMatch(fileTypes) || findMatch(FALLBACK_FILE_TYPES);
};