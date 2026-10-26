import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiClient,
  getUserId,
  HttpError,
  setBaseUrl,
  setUserId,
} from './apiClient.ts';
import { HttpSnippetOperations, normalizeCompliance } from './snippetOperations.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setBaseUrl(null);
  setUserId(null);
});

test('apiClient sends default headers and handles JSON responses', async () => {
  setBaseUrl('http://test-server:8080/');
  setUserId('my-user-123');

  let interceptedUrl = '';
  let interceptedInit: RequestInit | undefined;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    interceptedUrl = String(input);
    interceptedInit = init;
    return new Response(JSON.stringify({ result: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const data = await apiClient.get<{ result: string }>('/snippets');
  assert.equal(interceptedUrl, 'http://test-server:8080/snippets');
  assert.equal(
    (interceptedInit?.headers as Record<string, string>)['X-User-Id'],
    'my-user-123'
  );
  assert.equal(
    (interceptedInit?.headers as Record<string, string>)['Content-Type'],
    'application/json'
  );
  assert.deepEqual(data, { result: 'ok' });
});

test('apiClient handles Headers instance and case-insensitive headers without duplicates', async () => {
  setBaseUrl('http://test-server:8080');

  let interceptedHeaders: Record<string, string> = {};
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    interceptedHeaders = init?.headers as Record<string, string>;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const headers = new Headers();
  headers.set('x-user-id', 'custom-override-id');
  headers.set('content-type', 'application/json');
  headers.set('Custom-Header', 'custom-val');

  await apiClient.get('/test', { headers });

  assert.equal(interceptedHeaders['x-user-id'], 'custom-override-id');
  assert.equal(interceptedHeaders['X-User-Id'], undefined);
  assert.equal(interceptedHeaders['custom-header'], 'custom-val');
});

test('apiClient handles status 204 No Content returning undefined', async () => {
  setBaseUrl('http://test-server:8080');
  globalThis.fetch = async (): Promise<Response> => {
    return new Response(null, { status: 204 });
  };

  const res = await apiClient.delete('/snippets/abc');
  assert.equal(res, undefined);
});

test('apiClient extracts structured compiler errors without [object Object]', async () => {
  setBaseUrl('http://test-server:8080');
  globalThis.fetch = async (): Promise<Response> => {
    const errorPayload = {
      error: 'Snippet inválido',
      errors: [
        {
          message: "Expected ';'",
          line: 3,
          column: 12,
          endLine: 3,
          endColumn: 13,
        },
      ],
    };
    return new Response(JSON.stringify(errorPayload), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'Content-Type': 'application/json' },
    });
  };

  await assert.rejects(
    async () => {
      await apiClient.post('/snippets', { name: 'bad snippet' });
    },
    (err: unknown) => {
      assert(err instanceof HttpError);
      assert.equal(err.status, 422);
      assert(!err.message.includes('[object Object]'));
      assert.match(err.message, /Snippet inválido: Expected ';'/);
      assert.match(err.message, /line 3/);
      assert.match(err.message, /col 12/);
      return true;
    }
  );
});

test('apiClient handles plain text / non-JSON error responses', async () => {
  setBaseUrl('http://test-server:8080');
  globalThis.fetch = async (): Promise<Response> => {
    return new Response('502 Bad Gateway from reverse proxy', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/plain' },
    });
  };

  await assert.rejects(
    async () => {
      await apiClient.get('/snippets');
    },
    (err: unknown) => {
      assert(err instanceof HttpError);
      assert.equal(err.status, 502);
      assert.equal(err.message, '502 Bad Gateway from reverse proxy');
      return true;
    }
  );
});

test('getUserId falls back to test-user-id on empty or whitespace strings', () => {
  setUserId('   ');
  assert.equal(getUserId(), 'test-user-id');

  setUserId('valid-user');
  assert.equal(getUserId(), 'valid-user');

  setUserId(null);
  assert.equal(getUserId(), 'test-user-id');
});

test('normalizeCompliance normalizes backend status values to UI ComplianceEnum', () => {
  assert.equal(normalizeCompliance('COMPLIANT'), 'compliant');
  assert.equal(normalizeCompliance('NON_COMPLIANT'), 'not-compliant');
  assert.equal(normalizeCompliance('not-compliant'), 'not-compliant');
  assert.equal(normalizeCompliance('FAILED'), 'failed');
  assert.equal(normalizeCompliance('PENDING'), 'pending');
  assert.equal(normalizeCompliance(undefined), 'pending');
});

test('HttpSnippetOperations.listSnippetDescriptors maps array of summaries and normalizes compliance', async () => {
  setBaseUrl('http://localhost:8080');
  setUserId('test-user');

  const mockSummaries = [
    {
      id: 'uuid-1',
      name: 'Snippet One',
      description: 'First snippet',
      language: 'printscript',
      version: '1.1',
      ownerId: 'author-1',
      compliance: 'NON_COMPLIANT',
    },
    {
      id: 'uuid-2',
      name: 'Snippet Two',
      description: 'Second snippet',
      language: 'python',
      version: '3',
      ownerId: 'author-2',
      compliance: 'COMPLIANT',
    },
  ];

  let requestUrl = '';
  globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
    requestUrl = String(input);
    return new Response(JSON.stringify(mockSummaries), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const ops = new HttpSnippetOperations();
  const result = await ops.listSnippetDescriptors(0, 10, 'One');

  assert.equal(requestUrl, 'http://localhost:8080/snippets?name=One');
  assert.equal(result.count, 2);
  assert.equal(result.snippets.length, 2);

  const first = result.snippets[0];
  assert.equal(first.id, 'uuid-1');
  assert.equal(first.name, 'Snippet One');
  assert.equal(first.language, 'printscript');
  assert.equal(first.extension, 'ps');
  assert.equal(first.author, 'author-1');
  assert.equal(first.compliance, 'not-compliant');

  const second = result.snippets[1];
  assert.equal(second.id, 'uuid-2');
  assert.equal(second.extension, 'py');
  assert.equal(second.author, 'author-2');
  assert.equal(second.compliance, 'compliant');
});

test('HttpSnippetOperations.listSnippetDescriptors supports Spring Data Page format', async () => {
  setBaseUrl('http://localhost:8080');

  globalThis.fetch = async (): Promise<Response> => {
    return new Response(
      JSON.stringify({
        content: [
          {
            id: 'uuid-page',
            name: 'Page Snippet',
            language: 'printscript',
            ownerId: 'owner-page',
            compliance: 'COMPLIANT',
          },
        ],
        totalElements: 42,
        size: 10,
        number: 0,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  const ops = new HttpSnippetOperations();
  const result = await ops.listSnippetDescriptors(0, 10);
  assert.equal(result.count, 42);
  assert.equal(result.snippets.length, 1);
  assert.equal(result.snippets[0].name, 'Page Snippet');
  assert.equal(result.snippets[0].compliance, 'compliant');
});

test('HttpSnippetOperations.createSnippet maps request and response', async () => {
  setBaseUrl('http://localhost:8080');
  setUserId('user-owner');

  let sentBody: string | undefined;
  globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    sentBody = String(init?.body);
    return new Response(
      JSON.stringify({
        id: 'new-uuid',
        name: 'My New Snippet',
        description: '',
        language: 'printscript',
        version: '1.1',
        ownerId: 'user-owner',
        content: 'println(42);',
        compliance: 'PENDING',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  const ops = new HttpSnippetOperations();
  const created = await ops.createSnippet({
    name: 'My New Snippet',
    content: 'println(42);',
    language: 'printscript',
    extension: 'prs',
  });

  const parsedBody = JSON.parse(sentBody!);
  assert.equal(parsedBody.name, 'My New Snippet');
  assert.equal(parsedBody.version, '1.1');
  assert.equal(parsedBody.language, 'printscript');
  assert.equal(parsedBody.content, 'println(42);');

  assert.equal(created.id, 'new-uuid');
  assert.equal(created.name, 'My New Snippet');
  assert.equal(created.content, 'println(42);');
  assert.equal(created.author, 'user-owner');
  assert.equal(created.extension, 'prs');
  assert.equal(created.compliance, 'pending');
});

test('HttpSnippetOperations.getSnippetById returns snippet or undefined on 404', async () => {
  setBaseUrl('http://localhost:8080');

  // Found case
  globalThis.fetch = async (): Promise<Response> => {
    return new Response(
      JSON.stringify({
        id: 'found-id',
        name: 'Found Snippet',
        description: 'desc',
        language: 'printscript',
        version: '1.1',
        ownerId: 'owner-id',
        content: 'let a = 1;',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  const ops = new HttpSnippetOperations();
  const found = await ops.getSnippetById('found-id');
  assert(found);
  assert.equal(found.id, 'found-id');
  assert.equal(found.content, 'let a = 1;');

  // Not found (404) case
  globalThis.fetch = async (): Promise<Response> => {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const notFound = await ops.getSnippetById('missing-id');
  assert.equal(notFound, undefined);
});

test('HttpSnippetOperations.updateSnippetById sends PATCH and returns updated snippet', async () => {
  setBaseUrl('http://localhost:8080');

  let method = '';
  let sentBody = '';
  globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    method = init?.method ?? '';
    sentBody = String(init?.body);
    return new Response(
      JSON.stringify({
        id: 'upd-id',
        name: 'Existing Snippet',
        description: '',
        language: 'printscript',
        version: '1.1',
        ownerId: 'owner-id',
        content: 'updated content',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  const ops = new HttpSnippetOperations();
  const updated = await ops.updateSnippetById('upd-id', {
    content: 'updated content',
  });

  assert.equal(method, 'PATCH');
  assert.deepEqual(JSON.parse(sentBody), { content: 'updated content' });
  assert.equal(updated.content, 'updated content');
});

test('HttpSnippetOperations.deleteSnippet calls DELETE and returns id', async () => {
  setBaseUrl('http://localhost:8080');

  let method = '';
  let urlCalled = '';
  globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    method = init?.method ?? '';
    urlCalled = String(url);
    return new Response(null, { status: 204 });
  };

  const ops = new HttpSnippetOperations();
  const deletedId = await ops.deleteSnippet('snippet-to-delete');

  assert.equal(method, 'DELETE');
  assert.equal(urlCalled, 'http://localhost:8080/snippets/snippet-to-delete');
  assert.equal(deletedId, 'snippet-to-delete');
});

test('HttpSnippetOperations rule and helper methods work', async () => {
  const ops = new HttpSnippetOperations();

  const fileTypes = await ops.getFileTypes();
  assert(fileTypes.length > 0);
  assert(fileTypes.some((f) => f.language === 'printscript'));

  const rules = await ops.getFormatRules();
  assert(rules.length > 0);

  const lintRules = await ops.getLintingRules();
  assert(lintRules.length > 0);

  const formatted = await ops.formatSnippet('let a = 1;');
  assert(typeof formatted === 'string');

  const testCases = await ops.getTestCases();
  assert(Array.isArray(testCases));
  assert(testCases.length >= 2);

  const friends = await ops.getUserFriends();
  assert(friends.users.length > 0);
});

test('apiClient does not set application/json content-type on FormData', async () => {
  setBaseUrl('http://test-server:8080');

  let interceptedHeaders: Record<string, string> | undefined;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    interceptedHeaders = init?.headers as Record<string, string>;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const formData = new FormData();
  formData.append('key', 'value');
  await apiClient.post('/upload', formData);

  assert.equal(interceptedHeaders?.['Content-Type'], undefined);
  assert.equal(interceptedHeaders?.['X-User-Id'], getUserId());
});
