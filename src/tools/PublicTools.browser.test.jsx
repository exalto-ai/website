import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { ProviderIdentity } from './ProviderIdentity';
import { PlatformApiError } from './platform-api/client';
import { PublicTracePage, PublicTraces, VerificationPage } from './site/PublicTracePages';
import { RegistryPage, HostedNotaryRecord } from './site/RegistryPage';
import { PublicTools } from './site/PublicTools';
afterEach(async () => {
  cleanup();
  document.querySelectorAll('[data-test-metadata]').forEach((element) => {
    element.remove();
  });
  window.history.replaceState({}, '', '/');
  window.localStorage.removeItem('notary-theme');
  window.localStorage.removeItem('notary-session');
  await page.viewport(1280, 900);
});
const libraryShares = Array.from({ length: 20 }, (_, index) => ({
  trace_id: `share-${index + 1}`,
  title: `Prompt for share-${index + 1}`,
  provider: index === 11 ? 'anthropic' : 'openai',
  model: index === 11 ? 'claude-sonnet-4-6' : 'gpt-5.2',
  publisher: 'fixture-user',
  shared_at: Math.floor(Date.now() / 1000) - index * 24 * 60 * 60,
  authenticated_at_unix_ms: 1_786_000_000_000 - index,
  input_preview: `Prompt for share-${index + 1}`,
  output_preview: `Response for share-${index + 1}`,
  password_protected: false,
  public_url: `https://example.test/s/share-${index + 1}`,
}));
const loadLibrary = async ({ limit = 20, cursor, search, provider, shared_after } = {}) => {
  const query = search?.toLowerCase() || '';
  const matches = libraryShares.filter((share) => {
    const text =
      `${share.provider} ${share.model} ${share.publisher} ${share.input_preview} ${share.output_preview}`.toLowerCase();
    return (
      (!query || text.includes(query)) &&
      (!provider || share.provider === provider) &&
      (!shared_after || share.shared_at >= shared_after)
    );
  });
  const offset = cursor ? Number(cursor) : 0;
  const items = matches.slice(offset, offset + limit);
  return {
    items: structuredClone(items),
    next_cursor: offset + limit < matches.length ? String(offset + limit) : null,
  };
};
const loadLibraryTrace = async (id) => ({
  resourceSpans: [
    {
      scopeSpans: [
        {
          spans: [
            {
              name: 'gen_ai.inference',
              spanId: `${id}-span`,
              attributes: [
                {
                  key: 'gen_ai.input.messages',
                  value: {
                    stringValue: JSON.stringify([
                      { role: 'user', parts: [{ type: 'text', content: `Prompt for ${id}` }] },
                    ]),
                  },
                },
                {
                  key: 'gen_ai.output.messages',
                  value: {
                    stringValue: JSON.stringify([
                      {
                        role: 'assistant',
                        parts: [{ type: 'text', content: `Response for ${id}` }],
                      },
                    ]),
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
const balanceFixture = (remaining = 1_024) => ({
  included_monthly_remaining_bytes: remaining,
  supplemental_remaining_bytes: 0,
  total_granted_bytes: remaining,
  total_remaining_bytes: remaining,
  total_used_bytes: 0,
  next_grant_expiration: null,
});
const creditsFixture = (remaining = 1_024) => ({
  capture: balanceFixture(remaining),
  notarization: balanceFixture(remaining),
  reset_at: 4_102_444_800,
});
const billingFixture = (overrides = {}) => ({
  plan: 'free',
  billing_status: 'active',
  purchase_mode: 'disabled',
  subscriptions_configured: false,
  entitlements: {
    monthly_capture_bytes: 50_000_000,
    monthly_notarization_bytes: 50_000_000,
    trace_storage_bytes: 1_000_000_000,
  },
  ...overrides,
});
const usageFixture = ({
  credits = creditsFixture(),
  captures = 0,
  notarizations = 0,
  total = 0,
  shared = 0,
  verifying = 0,
  storedBytes = 0,
} = {}) => ({
  credits,
  operations: { captures, notarizations },
  hosted_traces: { total, shared, verifying, needs_attention: 0, stored_bytes: storedBytes },
});
test('keeps an OpenRouter icon when its model slug names an upstream vendor', async () => {
    render(
      <PublicTraces
        loadShares={async () => ({
          items: [
            {
              trace_id: 'routed-share',
              provider: 'openrouter',
              model: 'openai/gpt-5-mini',
              publisher: 'fixture-user',
              authenticated_at_unix_ms: 1_786_000_000_000,
              input_preview: 'Compare these records.',
              output_preview: 'The second record is stronger.',
              public_url: 'https://example.test/s/routed-share',
            },
          ],
          next_cursor: null,
        })}
      />,
    );

    const row = page.getByRole('link', { name: /openai\/gpt-5-mini/ });
    await expect.element(row).toBeVisible();
    expect(row.element().querySelector('[data-provider-icon="openrouter"]')).not.toBeNull();
    expect(row.element().querySelector('[data-provider-icon="openai"]')).toBeNull();
  });

test('renders a zero notary lower bound as an unbounded interval', async () => {
    render(
      <HostedNotaryRecord
        record={{
          name: 'Seal',
          operator: 'Exalto',
          host: 'notary.example',
          port: 7047,
          transport: 'tls',
          status: 'active',
          key_id: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          valid_from_unix_ms: 0,
          valid_until_unix_ms: null,
          notarize_until_unix_ms: null,
        }}
        activeKeyId="sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        copiedKeyId={null}
        onCopy={() => {}}
      />,
    );

    await expect.element(page.getByText('No lower bound configured')).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Seal' })).toBeVisible();
    await expect.element(page.getByText(/Operated by Exalto/)).toBeVisible();
    await expect.element(page.getByText(/1969|1970/)).not.toBeInTheDocument();
  });

test('presents the official Registry as named operators, keys, and trust history', async () => {
    const activeKeyId = `sha256:${'a'.repeat(64)}`;
    const historicalKeyId = `sha256:${'b'.repeat(64)}`;
    render(
      <RegistryPage
        loadRegistry={async () => ({
          format: 'notary/registry/v1',
          generation: 7,
          active_key_id: activeKeyId,
          notaries: [
            {
              name: 'Seal',
              operator: 'Exalto',
              host: 'notary.exalto.ai',
              port: 443,
              transport: 'tls',
              status: 'active',
              key_id: activeKeyId,
              verification_key: 'active-key',
              valid_from_unix_ms: 1_786_000_000_000,
              valid_until_unix_ms: null,
              notarize_until_unix_ms: null,
            },
            {
              name: 'seal1',
              operator: 'Exalto',
              host: 'retired-notary.exalto.ai',
              port: 443,
              transport: 'tls',
              status: 'retired',
              key_id: historicalKeyId,
              verification_key: 'historical-key',
              valid_from_unix_ms: 1_700_000_000_000,
              valid_until_unix_ms: 1_750_000_000_000,
              notarize_until_unix_ms: 1_760_000_000_000,
            },
          ],
        })}
      />,
    );

    await expect.element(page.getByRole('heading', { name: 'Official Notaries' })).toBeVisible();
    await expect.element(page.getByText('Generation 7')).toBeVisible();
    await expect.element(page.getByText('Active verification key').first()).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Trust history' })).toBeVisible();
    expect(page.getByRole('heading', { name: 'Seal', exact: true }).elements()).toHaveLength(2);
    expect(page.getByRole('heading', { name: 'seal1', exact: true }).elements()).toHaveLength(1);
    expect(page.getByText(/Operated by Exalto/).elements()).toHaveLength(3);
    await expect.element(page.getByText('Historical verification only')).toBeVisible();
  });

test('makes public Trace rows distinct and uncluttered on a phone', async () => {
    await page.viewport(390, 760);
    render(<PublicTraces loadShares={loadLibrary} />);
    await expect.element(page.getByRole('heading', { name: 'Traces' })).toBeVisible();
    const row = page.getByRole('link', { name: /claude-sonnet-4-6/ });
    await expect.element(row).toBeVisible();
    expect(row.element().textContent.match(/Prompt for share-12/g)).toHaveLength(1);
    expect(row.element().textContent).toContain('Response for share-12');
    expect(row.element().textContent).toContain('Sealed');
    expect(document.body.textContent).not.toContain('Verified');
    expect(document.body.textContent).not.toContain('↗');
    expect(document.body.textContent).not.toContain('Listed shares');
  });

test('filters public Traces by their safe summaries', async () => {
    render(<PublicTraces loadShares={loadLibrary} />);
    await expect.element(page.getByLabelText('Browse public traces')).toBeVisible();
    const search = page.getByPlaceholder('Search conversations or models');
    await search.fill('claude');
    await expect.element(page.getByRole('link', { name: /claude-sonnet-4-6/ })).toBeVisible();
    await expect.element(page.getByRole('link', { name: /gpt-5.2/ })).not.toBeInTheDocument();
  });

test('filters public Traces by date shared', async () => {
    const requests = [];
    render(
      <PublicTraces
        loadShares={async (options) => {
          requests.push(options);
          return loadLibrary(options);
        }}
      />,
    );
    await expect.element(page.getByText('20 traces shown')).toBeVisible();
    await page.getByRole('combobox', { name: 'Date shared' }).click();
    await page.getByRole('option', { name: 'Past 7 days' }).click();
    await expect.element(page.getByText(/^[78] traces shown$/)).toBeVisible();
    await expect
      .element(page.getByText(/Date filters omit password-protected entries/))
      .toBeVisible();
    expect(requests.at(-1).shared_after).toBeGreaterThan(Math.floor(Date.now() / 1000) - 8 * 86400);
  });

test('uses the settled empty state for public Traces', async () => {
    render(<PublicTraces loadShares={async () => ({ items: [], next_cursor: null })} />);
    await expect.element(page.getByText('No traces have been shared publicly yet.')).toBeVisible();
  });

test('keeps public Trace controls and reports a failed filtered request', async () => {
    const loadShares = async (options) => {
      if (options.search) throw new Error('Search is temporarily unavailable.');
      return { items: [libraryShares[0]], next_cursor: 'old-cursor' };
    };
    render(<PublicTraces loadShares={loadShares} />);
    await expect.element(page.getByRole('link', { name: /gpt-5.2/ })).toBeVisible();

    const search = page.getByPlaceholder('Search conversations or models');
    await search.fill('claude');
    await expect.element(search).toBeVisible();
    await expect.element(page.getByText('Search is temporarily unavailable.')).toBeVisible();
    await expect.element(page.getByRole('link', { name: /gpt-5.2/ })).not.toBeInTheDocument();
  });

test('waits for an indexable public Trace search term', async () => {
    let requests = 0;
    render(
      <PublicTraces
        loadShares={async (options) => {
          requests += 1;
          return loadLibrary(options);
        }}
      />,
    );
    await expect.element(page.getByText('20 traces shown')).toBeVisible();
    const beforeSearch = requests;

    await page.getByPlaceholder('Search conversations or models').fill('ai');
    await expect
      .element(page.getByText('Search needs three letters or numbers together.'))
      .toBeVisible();
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    expect(requests).toBe(beforeSearch);
  });

test('keeps public Trace filters while loading the next page', async () => {
    const requests = [];
    const first = libraryShares[11];
    const second = {
      ...libraryShares[11],
      trace_id: 'share-continued',
      model: 'claude-haiku-4-5',
    };
    const loadShares = async (options) => {
      requests.push(options);
      return options.cursor
        ? { items: [second], next_cursor: null }
        : { items: [first], next_cursor: 'next-library-page' };
    };
    render(<PublicTraces loadShares={loadShares} />);

    const search = page.getByPlaceholder('Search conversations or models');
    await search.fill('claude');
    await expect.element(page.getByRole('link', { name: /claude-sonnet-4-6/ })).toBeVisible();
    await page.getByRole('button', { name: 'Load more traces' }).click();
    await expect.element(page.getByRole('link', { name: /claude-haiku-4-5/ })).toBeVisible();
    expect(requests.at(-1)).toMatchObject({
      cursor: 'next-library-page',
      search: 'claude',
      limit: 20,
    });
  });

test('discards an old public Trace continuation after filters change', async () => {
    let resolveOldPage;
    let markLoadStarted;
    const loadStarted = new Promise((resolve) => {
      markLoadStarted = resolve;
    });
    const initial = libraryShares[0];
    const filtered = libraryShares[11];
    const stale = {
      ...libraryShares[0],
      trace_id: 'stale-share',
      output_preview: 'Stale continuation',
    };
    const loadShares = async (options) => {
      if (options.cursor) {
        markLoadStarted();
        return new Promise((resolve) => {
          resolveOldPage = resolve;
        });
      }
      if (options.search === 'claude') return { items: [filtered], next_cursor: null };
      return { items: [initial], next_cursor: 'old-cursor' };
    };
    render(<PublicTraces loadShares={loadShares} />);

    await expect.element(page.getByRole('button', { name: 'Load more traces' })).toBeVisible();
    await page.getByRole('button', { name: 'Load more traces' }).click();
    await loadStarted;
    await page.getByPlaceholder('Search conversations or models').fill('claude');
    await expect
      .element(page.getByRole('button', { name: 'Load more traces' }))
      .not.toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: /claude-sonnet-4-6/ })).toBeVisible();

    resolveOldPage({ items: [stale], next_cursor: 'stale-cursor' });
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await expect.element(page.getByText('Stale continuation')).not.toBeInTheDocument();
    await expect
      .element(page.getByRole('button', { name: 'Load more traces' }))
      .not.toBeInTheDocument();
  });

test('does not treat a bare legacy trace as a package-backed preview', async () => {
    let traceLoads = 0;
    render(
      <PublicTraces
        loadShares={async () => ({
          items: [
            {
              trace_id: 'legacy-share',
              provider: 'openai',
              model: 'gpt-4.1',
              publisher: 'fixture-user',
              authenticated_at_unix_ms: 1_786_000_000_000,
              public_url: 'https://example.test/s/legacy-share',
            },
          ],
          next_cursor: null,
        })}
        loadTrace={async (id) => {
          traceLoads += 1;
          return loadLibraryTrace(id);
        }}
      />,
    );

    await expect.element(page.getByText('No prompt or response preview.')).toBeVisible();
    expect(traceLoads).toBe(0);
  });

test('puts the disclosed conversation before collapsible evidence and tools', async () => {
    const descriptionMetadata = document.createElement('meta');
    descriptionMetadata.name = 'description';
    descriptionMetadata.dataset.testMetadata = 'true';
    document.head.appendChild(descriptionMetadata);
    const loadShare = async () => ({
      trace_id: 'share-12',
      title: 'Compare these two evidence trails.',
      visibility: 'listed',
      password_protected: false,
      expires_at: null,
      publisher: 'fixture-user',
      shared_at: 1_786_000_001,
      authenticated_at_unix_ms: 1_786_000_000_000,
      provider: 'anthropic',
      host: 'api.anthropic.com',
      model: 'claude-sonnet-4-6',
      notarized_state: 'notarized',
      hosted_verification: 'passed',
      notary_key_id: 'sha256:abc',
      notary_name: 'Seal',
      notary_operator: 'Exalto',
      registry_generation: 42,
      trust_source: 'hosted_registry',
      content_sha256: 'b'.repeat(64),
      package_size_bytes: 4096,
      package_sha256: 'c'.repeat(64),
      disclosure_safety_version: 'notary/public-package-safety/v1',
      disclosure_safety_override: false,
      trace_url: '/api/public/traces/share-12/trace.otlp.json',
      package_url: '/api/public/traces/share-12/package.llmtrace',
      public_url: 'https://example.test/s/share-12',
    });
    const loadTrace = async () => ({
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  name: 'gen_ai.inference',
                  spanId: 'span-12',
                  attributes: [
                    {
                      key: 'gen_ai.input.messages',
                      value: {
                        stringValue: JSON.stringify([
                          {
                            role: 'user',
                            parts: [
                              { type: 'text', content: 'Compare these two evidence trails.' },
                            ],
                          },
                        ]),
                      },
                    },
                    {
                      key: 'gen_ai.output.messages',
                      value: {
                        stringValue: JSON.stringify([
                          {
                            role: 'assistant',
                            parts: [
                              { type: 'text', content: 'The second trail is stronger.' },
                              {
                                type: 'tool_call',
                                id: 'call-1',
                                name: 'lookup_record',
                                arguments: { id: 42 },
                              },
                              {
                                type: 'tool_call_response',
                                id: 'call-1',
                                result: { source: 'fixture record 42' },
                              },
                            ],
                          },
                        ]),
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    render(<PublicTracePage traceId="share-12" loadShare={loadShare} loadTrace={loadTrace} />);
    const conversation = page.getByRole('region', { name: 'Conversation' });
    await expect
      .element(conversation.getByText('Compare these two evidence trails.'))
      .toBeVisible();
    await expect.element(conversation.getByText('The second trail is stronger.')).toBeVisible();
    const tool = page.getByText('lookup_record');
    await expect.element(tool).toBeVisible();
    expect(tool.element().closest('details')?.open).toBe(false);
    await tool.click();
    await expect.element(page.getByText('arguments')).toBeVisible();
    const toolResult = page.getByText('Tool result');
    await expect.element(toolResult).toBeVisible();
    await toolResult.click();
    await expect.element(page.getByText('fixture record 42')).toBeVisible();
    await expect
      .element(page.getByRole('heading', { name: 'Compare these two evidence trails.' }))
      .toBeVisible();
    expect(document.querySelector('.share-verification-mark b')?.textContent).toBe('Sealed');
    await expect.element(page.getByText('Hosted verification passed')).toBeVisible();
    await expect.element(page.getByText(/Notarized by Seal · Operated by Exalto/)).toBeVisible();
    await expect.element(page.getByRole('link', { name: /Export .llmtrace/ })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await expect.element(page.getByRole('link', { name: 'Verify independently' })).toBeVisible();
    await page.getByText('Hashes and notary').click();
    await expect.element(page.getByText('4,096 bytes')).toBeVisible();
    await expect.element(page.getByText('c'.repeat(64))).toBeVisible();
    expect(document.title).toBe('Compare these two evidence trails. · Exalto Seal');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Compare these two evidence trails. · anthropic claude-sonnet-4-6 · shared by fixture-user',
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'noindex',
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain(
      '/s/share-12',
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toContain(
      '/s/share-12',
    );
    expect(
      page.getByRole('link', { name: 'Verify independently' }).element().getAttribute('href'),
    ).toBe('https://capture.exalto.ai/docs/trace-packages');

    cleanup();
    render(
      <PublicTracePage
        traceId="share-12"
        loadShare={async () => ({ ...(await loadShare()), visibility: 'unlisted' })}
        loadTrace={loadTrace}
      />,
    );
    await expect
      .element(page.getByRole('heading', { name: 'Compare these two evidence trails.' }))
      .toBeVisible();
    expect(document.title).toBe('Shared trace · Exalto');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'A shared sealed trace from Exalto Seal.',
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'noindex',
    );
  });

test('opens a protected trace in memory and submits a bounded report', async () => {
    let unlocked = false;
    const required = () => {
      throw new PlatformApiError('Public Trace is unavailable', 404, 'trace_unavailable');
    };
    const loadShare = async () => {
      if (!unlocked) required();
      return {
        trace_id: 'protected-share',
        title: 'Prompt for protected-share',
        visibility: 'listed',
        password_protected: true,
        expires_at: 4_102_444_800,
        publisher: 'fixture-user',
        shared_at: 1_786_000_000,
        authenticated_at_unix_ms: 1_786_000_000_000,
        provider: 'openai',
        host: 'api.openai.com',
        model: 'gpt-5.2',
        notarized_state: 'notarized',
        hosted_verification: 'passed',
        notary_key_id: 'sha256:abc',
        notary_name: 'Seal',
        notary_operator: 'Exalto',
        registry_generation: 42,
        trust_source: 'hosted_registry',
        content_sha256: 'b'.repeat(64),
        package_size_bytes: 2048,
        package_sha256: 'c'.repeat(64),
        disclosure_safety_version: 'notary/public-package-safety/v1',
        disclosure_safety_override: false,
        trace_url: '/api/public/traces/protected-share/trace.otlp.json',
        package_url: '/api/public/traces/protected-share/package.llmtrace',
        public_url: 'https://example.test/s/protected-share',
      };
    };
    const loadTrace = async (id) => {
      if (!unlocked) required();
      return loadLibraryTrace(id);
    };
    let report;
    render(
      <PublicTracePage
        traceId="protected-share"
        loadShare={loadShare}
        loadTrace={loadTrace}
        accessTrace={async (_id, password) => {
          if (password !== 'evidence-pass') required();
          unlocked = true;
        }}
        sendReport={async (...args) => {
          report = args;
          return { received: true };
        }}
      />,
    );

    await expect.element(page.getByRole('heading', { name: 'Open shared trace' })).toBeVisible();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'noindex',
    );
    await page.getByLabelText('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Open trace' }).click();
    await expect
      .element(page.getByRole('alert').getByText('That password did not open this trace.'))
      .toBeVisible();
    await page.getByLabelText('Password').fill('evidence-pass');
    await page.getByRole('button', { name: 'Open trace' }).click();
    await expect
      .element(
        page.getByRole('region', { name: 'Conversation' }).getByText('Prompt for protected-share'),
      )
      .toBeVisible();
    expect(document.title).toBe('Shared trace · Exalto');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'noindex',
    );

    await page.getByRole('button', { name: 'Report this trace' }).click();
    await page.getByRole('combobox', { name: 'Report reason' }).click();
    await page.getByRole('option', { name: 'Spam or misleading content' }).click();
    await page
      .getByPlaceholder('Briefly explain the issue')
      .fill('The listing misrepresents the disclosed response.');
    await page.getByRole('button', { name: 'Send report' }).click();
    expect(report).toEqual([
      'protected-share',
      { reason: 'spam', message: 'The listing misrepresents the disclosed response.' },
    ]);
    await expect.element(page.getByRole('heading', { name: 'Report received' })).toBeVisible();
  });

test('uses generic, non-indexed public responses for unavailable shares', async () => {
    render(
      <PublicTracePage
        traceId="unavailable-share"
        loadShare={async () => {
          throw new PlatformApiError('Storage backend failed', 503, 'storage_unavailable');
        }}
        loadTrace={async () => {
          throw new PlatformApiError('Trace content failed', 503, 'storage_unavailable');
        }}
      />,
    );

    await expect
      .element(page.getByRole('heading', { name: 'Shared trace unavailable' }))
      .toBeVisible();
    await expect
      .element(page.getByText(/expired, stopped, missing, or temporarily unavailable/))
      .toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Open public Traces' }))
      .toHaveAttribute('href', '/traces');
    expect(document.body.textContent).not.toContain('Storage backend failed');
    expect(document.body.textContent).not.toContain('Trace content failed');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'noindex',
    );
    expect(document.title).toBe('Shared trace · Exalto');
  });

test('requires disclosure consent before hosted package verification', async () => {
    const verified = {
      verified: true,
      trace_id: 'sanitized-capture',
      provider: 'openai',
      host: 'api.openai.com',
      authenticated_at_unix_ms: 1_786_000_000_000,
      notary_key_id: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      trust_source: 'hosted_registry',
      registry_generation: 42,
      content_sha256: 'b'.repeat(64),
      package_sha256: 'c'.repeat(64),
      trace: await loadLibraryTrace('verified'),
    };
    let calls = 0;
    render(
      <VerificationPage
        verifyFile={async () => {
          calls += 1;
          return verified;
        }}
      />,
    );
    const input = document.querySelector('input[type="file"]');
    expect(input.getAttribute('accept')).toBe(
      '.llmtrace,application/vnd.exalto.notary.trace-package+zip',
    );
    const file = new File(['sanitized fixture'], 'sanitized.llmtrace', {
      type: 'application/vnd.exalto.notary.trace-package+zip',
    });
    fireEvent.change(input, { target: { files: [file] } });

    await expect
      .element(page.getByText('Your package may contain sensitive content.'))
      .toBeVisible();
    await expect
      .element(
        page.getByText(
          'Headers are hidden by default, but prompts, responses, tool definitions, and tool results may be included. We check the package without saving it.',
        ),
      )
      .toBeVisible();
    await expect
      .element(page.getByText('I understand that this package may contain sensitive content.'))
      .toBeVisible();
    expect(calls).toBe(0);
    const submit = page.getByRole('button', { name: 'Verify package' });
    await expect.element(submit).toBeDisabled();
    await page.getByRole('checkbox').click();
    await expect.element(submit).toBeEnabled();
    await submit.click();

    await expect.element(page.getByRole('heading', { name: 'Verification passed.' })).toBeVisible();
    await expect.element(page.getByText('api.openai.com')).toBeVisible();
    await expect.element(page.getByText('Prompt for verified')).toBeVisible();
    expect(document.body.textContent).not.toContain('Provider verified');
    expect(calls).toBe(1);
  });

test('rejects an oversized or mislabeled upload before sending it', async () => {
    let calls = 0;
    render(
      <VerificationPage
        verifyFile={async () => {
          calls += 1;
        }}
      />,
    );
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['not a package'], 'notes.zip')] } });

    await expect
      .element(page.getByRole('heading', { name: 'File type is unsupported' }))
      .toBeVisible();
    expect(calls).toBe(0);
  });

test('presents safe verification failure and unsupported-version results', async () => {
    const renderFailure = async (code, heading) => {
      cleanup();
      render(
        <VerificationPage
          verifyFile={async () => {
            throw new PlatformApiError('Safe verifier detail', 422, code);
          }}
        />,
      );
      const input = document.querySelector('input[type="file"]');
      fireEvent.change(input, { target: { files: [new File(['package'], 'trace.llmtrace')] } });
      await page.getByRole('checkbox').click();
      await page.getByRole('button', { name: 'Verify package' }).click();
      await expect.element(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect.element(page.getByText(code)).toBeVisible();
      expect(document.body.textContent).not.toContain('Safe verifier detail');
    };

    await renderFailure('tampered_package', 'Package verification failed');
    await renderFailure('unsupported_version', 'Package version is unsupported');
  });

test('ignores an in-flight verification result after the selected file changes', async () => {
    let resolveVerification;
    const pendingVerification = new Promise((resolve) => {
      resolveVerification = resolve;
    });
    render(<VerificationPage verifyFile={() => pendingVerification} />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['first'], 'first.llmtrace')] } });
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Verify package' }).click();

    fireEvent.change(input, { target: { files: [new File(['second'], 'second.llmtrace')] } });
    await expect.element(page.getByText('second.llmtrace')).toBeVisible();
    resolveVerification({
      verified: true,
      trace: { resourceSpans: [] },
    });
    await new Promise((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
    );

    expect(document.body.textContent).not.toContain('Verification passed.');
    await expect.element(page.getByText('second.llmtrace')).toBeVisible();
  });

test('Seal opens public Traces without an account or creator navigation', async () => {
  const loadShares = vi.fn(async () => ({ items: [], next_cursor: null }));
  await page.viewport(320, 700);
  render(<PublicTools loadShares={loadShares} />);
  await expect.element(page.getByText('No traces have been shared publicly yet.')).toBeVisible();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  expect(loadShares).toHaveBeenCalledOnce();
  expect(document.title).toBe('Published Traces · Exalto');
  await expect
    .element(page.getByRole('link', { name: 'Capture ↗' }))
    .toHaveAttribute('href', 'https://capture.exalto.ai/app/');
  await expect
    .element(page.getByRole('link', { name: 'Sign in', exact: true }))
    .not.toBeInTheDocument();
});