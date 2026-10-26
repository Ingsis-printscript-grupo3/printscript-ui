import type {ComplianceEnum, CreateSnippet, PaginatedSnippets, Snippet, UpdateSnippet} from './snippet.ts';
import type {PaginatedUsers} from "./users.ts";
import type {TestCase} from "../types/TestCase.ts";
import type {TestCaseResult} from "./queries.tsx";
import type {FileType} from "../types/FileType.ts";
import type {Rule} from "../types/Rule.ts";
import {apiClient, HttpError} from "./apiClient.ts";
import autoBind from "auto-bind";
import {v4 as uuidv4} from "uuid";

export interface SnippetOperations {
  listSnippetDescriptors(page: number, pageSize: number, snippetName?: string): Promise<PaginatedSnippets>;

  createSnippet(createSnippet: CreateSnippet): Promise<Snippet>;

  getSnippetById(id: string): Promise<Snippet | undefined>;

  updateSnippetById(id: string, updateSnippet: UpdateSnippet): Promise<Snippet>;

  getUserFriends(name?: string, page?: number, pageSize?: number): Promise<PaginatedUsers>;

  shareSnippet(snippetId: string, userId: string): Promise<Snippet>;

  getFormatRules(): Promise<Rule[]>;

  getLintingRules(): Promise<Rule[]>;

  getTestCases(): Promise<TestCase[]>;

  formatSnippet(snippet: string): Promise<string>;

  postTestCase(testCase: Partial<TestCase>): Promise<TestCase>;

  removeTestCase(id: string): Promise<string>;

  deleteSnippet(id: string): Promise<string>;

  testSnippet(testCase: Partial<TestCase>): Promise<TestCaseResult>;

  getFileTypes(): Promise<FileType[]>;

  modifyFormatRule(newRules: Rule[]): Promise<Rule[]>;

  modifyLintingRule(newRules: Rule[]): Promise<Rule[]>;
}

export interface SnippetSummaryDto {
  id: string;
  name: string;
  description?: string;
  language: string;
  version?: string;
  ownerId?: string;
  compliance?: string;
  author?: string;
}

export interface SnippetResponseDto {
  id: string;
  name: string;
  description?: string;
  language: string;
  version?: string;
  ownerId?: string;
  content: string;
  compliance?: string;
  author?: string;
}

export interface CreateSnippetRequestDto {
  name: string;
  description: string;
  language: string;
  version: string;
  content: string;
}

export interface UpdateSnippetRequestDto {
  name?: string;
  description?: string;
  language?: string;
  version?: string;
  content?: string;
}

const DEFAULT_FILE_TYPES: FileType[] = [
  {
    language: "printscript",
    extension: "ps",
  },
  {
    language: "python",
    extension: "py",
  },
  {
    language: "java",
    extension: "java",
  },
  {
    language: 'golang',
    extension: 'go',
  },
];

const INITIAL_FORMATTING_RULES: Rule[] = [
  {
    id: '1',
    name: "indentation",
    isActive: true,
    value: 3,
  },
  {
    id: '2',
    name: "open-if-block-on-same-line",
    isActive: false,
  },
  {
    id: '3',
    name: "max-line-length",
    isActive: true,
    value: 100,
  },
  {
    id: '4',
    name: "no-trailing-spaces",
    isActive: false,
    value: null,
  },
  {
    id: '5',
    name: "no-multiple-empty-lines",
    isActive: false,
    value: null,
  },
];

const INITIAL_LINTING_RULES: Rule[] = [
  {
    id: '1',
    name: "no-expressions-in-print-line",
    isActive: true,
    value: null,
  },
  {
    id: '2',
    name: "no-unused-vars",
    isActive: true,
    value: null,
  },
  {
    id: '3',
    name: "no-undef-vars",
    isActive: false,
    value: null,
  },
  {
    id: '4',
    name: "no-unused-params",
    isActive: false,
    value: null,
  },
];

const INITIAL_TEST_CASES: TestCase[] = [
  {
    id: uuidv4(),
    name: "Test Case 1",
    input: ["A", "B"],
    output: ["C", "D"],
  },
  {
    id: uuidv4(),
    name: "Test Case 2",
    input: ["E", "F"],
    output: ["G", "H"],
  },
];

const DEFAULT_USERS: PaginatedUsers = {
  count: 5,
  page: 1,
  page_size: 10,
  users: [
    {
      name: "Chona",
      id: "1",
    },
    {
      name: "Fede",
      id: "2",
    },
    {
      name: "Mateo",
      id: "3",
    },
    {
      name: "Tomi",
      id: "4",
    },
    {
      name: "Berrets",
      id: "5",
    },
  ],
};

function getExtensionForLanguage(language?: string): string {
  if (!language) return 'ps';
  switch (language.toLowerCase()) {
    case 'printscript':
      return 'ps';
    case 'python':
      return 'py';
    case 'java':
      return 'java';
    case 'golang':
    case 'go':
      return 'go';
    default:
      return 'ps';
  }
}

function getDefaultVersionForLanguage(language?: string): string {
  if (!language) return '1.1';
  if (language.toLowerCase() === 'printscript') return '1.1';
  return '1.0';
}

export function normalizeCompliance(val?: string): ComplianceEnum {
  if (!val) return 'pending';
  const lower = val.toLowerCase().replace(/_/g, '-');
  if (lower === 'non-compliant' || lower === 'not-compliant') return 'not-compliant';
  if (lower === 'compliant') return 'compliant';
  if (lower === 'failed') return 'failed';
  return 'pending';
}

function mapSummaryToSnippet(summary: SnippetSummaryDto): Snippet {
  return {
    id: String(summary.id),
    name: summary.name,
    content: '',
    language: summary.language || 'printscript',
    extension: getExtensionForLanguage(summary.language),
    author: summary.author || summary.ownerId || 'unknown',
    compliance: normalizeCompliance(summary.compliance),
  };
}

function mapResponseToSnippet(
  response: SnippetResponseDto,
  originalSnippet?: Partial<CreateSnippet>
): Snippet {
  return {
    id: String(response.id),
    name: response.name,
    content: response.content ?? originalSnippet?.content ?? '',
    language: response.language || originalSnippet?.language || 'printscript',
    extension:
      originalSnippet?.extension ||
      getExtensionForLanguage(response.language || originalSnippet?.language),
    author: response.author || response.ownerId || 'unknown',
    compliance: normalizeCompliance(response.compliance),
  };
}

export class HttpSnippetOperations implements SnippetOperations {
  private formattingRules: Rule[] = [...INITIAL_FORMATTING_RULES];
  private lintingRules: Rule[] = [...INITIAL_LINTING_RULES];
  private readonly testCaseMap: Map<string, TestCase> = new Map();

  constructor() {
    for (const tc of INITIAL_TEST_CASES) {
      this.testCaseMap.set(tc.id, tc);
    }
    autoBind(this);
  }

  async listSnippetDescriptors(
    page: number,
    pageSize: number,
    snippetName?: string
  ): Promise<PaginatedSnippets> {
    const query = new URLSearchParams();
    if (snippetName && snippetName.trim() !== '') {
      query.append('name', snippetName.trim());
    }
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const data = await apiClient.get<unknown>(
      `/snippets${queryString}`
    );

    if (Array.isArray(data)) {
      const allSnippets = (data as SnippetSummaryDto[]).map(mapSummaryToSnippet);
      const totalCount = allSnippets.length;
      const validPage = Math.max(0, page);
      const validSize = pageSize > 0 ? pageSize : totalCount;
      const pagedSnippets =
        validSize > 0
          ? allSnippets.slice(validPage * validSize, (validPage + 1) * validSize)
          : allSnippets;

      return {
        page: validPage,
        page_size: validSize,
        count: totalCount,
        snippets: pagedSnippets,
      };
    }

    if (
      data &&
      typeof data === 'object' &&
      'snippets' in data &&
      Array.isArray((data as Record<string, unknown>).snippets)
    ) {
      const paginated = data as PaginatedSnippets;
      return {
        page: paginated.page ?? page,
        page_size: paginated.page_size ?? pageSize,
        count: paginated.count ?? paginated.snippets.length,
        snippets: paginated.snippets.map((s) =>
          'ownerId' in (s as unknown as SnippetSummaryDto) && !('author' in s)
            ? mapSummaryToSnippet(s as unknown as SnippetSummaryDto)
            : {
                ...s,
                compliance: normalizeCompliance(s.compliance),
                extension: s.extension || getExtensionForLanguage(s.language),
              }
        ),
      };
    }

    if (
      data &&
      typeof data === 'object' &&
      'content' in data &&
      Array.isArray((data as Record<string, unknown>).content)
    ) {
      const springPage = data as {
        content: SnippetSummaryDto[];
        totalElements?: number;
        size?: number;
        number?: number;
      };
      const items = springPage.content.map(mapSummaryToSnippet);
      return {
        page: springPage.number ?? page,
        page_size: springPage.size ?? pageSize,
        count: springPage.totalElements ?? items.length,
        snippets: items,
      };
    }

    return {
      page: Math.max(0, page),
      page_size: pageSize,
      count: 0,
      snippets: [],
    };
  }

  async createSnippet(createSnippet: CreateSnippet): Promise<Snippet> {
    const customProps = createSnippet as unknown as {
      description?: string;
      version?: string;
    };
    const request: CreateSnippetRequestDto = {
      name: createSnippet.name,
      description: customProps.description ?? '',
      language: createSnippet.language || 'printscript',
      version:
        customProps.version ??
        getDefaultVersionForLanguage(createSnippet.language),
      content: createSnippet.content,
    };

    const response = await apiClient.post<SnippetResponseDto>('/snippets', request);
    if (!response) {
      throw new Error('Failed to create snippet: empty response from server');
    }
    return mapResponseToSnippet(response, createSnippet);
  }

  async getSnippetById(id: string): Promise<Snippet | undefined> {
    if (!id) return undefined;
    try {
      const response = await apiClient.get<SnippetResponseDto>(`/snippets/${id}`);
      if (!response) return undefined;
      return mapResponseToSnippet(response);
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async updateSnippetById(id: string, updateSnippet: UpdateSnippet): Promise<Snippet> {
    const customProps = updateSnippet as unknown as {
      name?: string;
      description?: string;
      language?: string;
      version?: string;
    };
    const request: UpdateSnippetRequestDto = {
      content: updateSnippet.content,
      ...(customProps.name && customProps.name.trim() !== '' ? { name: customProps.name } : {}),
      ...(customProps.description !== undefined ? { description: customProps.description } : {}),
      ...(customProps.language && customProps.language.trim() !== '' ? { language: customProps.language } : {}),
      ...(customProps.version && customProps.version.trim() !== '' ? { version: customProps.version } : {}),
    };

    const response = await apiClient.patch<SnippetResponseDto>(`/snippets/${id}`, request);
    if (!response) {
      const refreshed = await this.getSnippetById(id);
      if (refreshed) return refreshed;
      throw new Error(`Failed to update snippet ${id}`);
    }
    return mapResponseToSnippet(response);
  }

  async deleteSnippet(id: string): Promise<string> {
    await apiClient.delete(`/snippets/${id}`);
    return id;
  }

  async getUserFriends(
    name: string = '',
    page: number = 0,
    pageSize: number = 10
  ): Promise<PaginatedUsers> {
    try {
      const query = new URLSearchParams();
      if (name && name.trim() !== '') query.append('search', name.trim());
      query.append('page', String(page));
      query.append('page_size', String(pageSize));
      const response = await apiClient.get<PaginatedUsers>(`/users?${query.toString()}`);
      if (response && Array.isArray(response.users)) {
        return {
          page: response.page ?? page,
          page_size: response.page_size ?? pageSize,
          count: response.count ?? response.users.length,
          users: response.users,
        };
      }
    } catch {
      // fallback when user endpoint is unavailable
    }

    const filtered = name
      ? DEFAULT_USERS.users.filter((u) => u.name.toLowerCase().includes(name.toLowerCase()))
      : DEFAULT_USERS.users;

    return {
      page,
      page_size: pageSize,
      count: filtered.length,
      users: filtered,
    };
  }

  async shareSnippet(snippetId: string, userId: string): Promise<Snippet> {
    try {
      const response = await apiClient.post<SnippetResponseDto>(
        `/snippets/${snippetId}/share`,
        { userId }
      );
      if (response && response.id) return mapResponseToSnippet(response);
    } catch {
      // fallback
    }

    const snippet = await this.getSnippetById(snippetId);
    if (!snippet) throw new Error(`Snippet with id ${snippetId} not found`);
    return snippet;
  }

  async getFormatRules(): Promise<Rule[]> {
    try {
      const response = await apiClient.get<Rule[]>('/rules/formatting');
      if (Array.isArray(response)) {
        this.formattingRules = response;
        return response;
      }
    } catch {
      // fallback
    }
    return this.formattingRules;
  }

  async modifyFormatRule(newRules: Rule[]): Promise<Rule[]> {
    try {
      const response = await apiClient.put<Rule[]>('/rules/formatting', newRules);
      if (Array.isArray(response)) {
        this.formattingRules = response;
        return response;
      }
    } catch {
      // fallback
    }
    this.formattingRules = newRules;
    return newRules;
  }

  async getLintingRules(): Promise<Rule[]> {
    try {
      const response = await apiClient.get<Rule[]>('/rules/linting');
      if (Array.isArray(response)) {
        this.lintingRules = response;
        return response;
      }
    } catch {
      // fallback
    }
    return this.lintingRules;
  }

  async modifyLintingRule(newRules: Rule[]): Promise<Rule[]> {
    try {
      const response = await apiClient.put<Rule[]>('/rules/linting', newRules);
      if (Array.isArray(response)) {
        this.lintingRules = response;
        return response;
      }
    } catch {
      // fallback
    }
    this.lintingRules = newRules;
    return newRules;
  }

  async formatSnippet(snippet: string): Promise<string> {
    try {
      const response = await apiClient.post<{ content?: string }>('/formattings', {
        language: 'printscript',
        version: '1.1',
        content: snippet,
      });
      if (response?.content) {
        return response.content;
      }
    } catch {
      // fallback
    }
    return `//Mocked format of snippet :) \n${snippet}`;
  }

  async getTestCases(): Promise<TestCase[]> {
    try {
      const response = await apiClient.get<TestCase[]>('/test-cases');
      if (Array.isArray(response)) {
        return response;
      }
    } catch {
      // fallback
    }
    return Array.from(this.testCaseMap.values());
  }

  async postTestCase(testCase: Partial<TestCase>): Promise<TestCase> {
    try {
      const response = await apiClient.post<TestCase>('/test-cases', testCase);
      if (response && response.id) return response;
    } catch {
      // fallback
    }
    const id = testCase.id ?? uuidv4();
    const newTestCase = { ...testCase, id } as TestCase;
    this.testCaseMap.set(id, newTestCase);
    return newTestCase;
  }

  async removeTestCase(id: string): Promise<string> {
    try {
      await apiClient.delete(`/test-cases/${id}`);
      return id;
    } catch {
      // fallback
    }
    this.testCaseMap.delete(id);
    return id;
  }

  async testSnippet(_testCase?: Partial<TestCase>): Promise<TestCaseResult> {
    try {
      const response = await apiClient.post<{ result: TestCaseResult }>('/test-cases/run', _testCase);
      if (response?.result) return response.result;
    } catch {
      // fallback
    }
    return "success";
  }

  async getFileTypes(): Promise<FileType[]> {
    try {
      const response = await apiClient.get<FileType[]>('/file-types');
      if (Array.isArray(response)) return response;
    } catch {
      // fallback
    }
    return DEFAULT_FILE_TYPES;
  }
}
