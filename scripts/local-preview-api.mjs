// Explicit development-only fixture service. Never contacts a hosted account,
// accepts evidence as verified, or performs a real billing/auth operation.
export function localPreviewApi(origins) {
  const now = 1_788_912_000;
  const balance = {
    included_monthly_remaining_bytes: 50_000_000,
    supplemental_remaining_bytes: 0,
    total_granted_bytes: 50_000_000,
    total_remaining_bytes: 50_000_000,
    total_used_bytes: 0,
    next_grant_expiration: null,
  };
  const examples = [
    [
      'Review the retry policy',
      'openai',
      'gpt-5.2',
      'Review this retry policy for a payment webhook.',
      'Retry transient failures with exponential backoff. Use an idempotency key so a repeated delivery cannot charge twice.',
    ],
    [
      'Explain the evidence boundary',
      'anthropic',
      'claude-sonnet-4-6',
      'What does a sealed Trace prove?',
      'It provides evidence of the disclosed exchange with an authenticated provider. It does not establish that the response is correct or that every interaction was disclosed.',
    ],
    [
      'Check a migration plan',
      'openai',
      'gpt-5.2',
      'How should we move a public link to a new domain?',
      'Preserve existing links, separate browser navigation from API compatibility, and test redirects before changing the canonical origin.',
    ],
  ].map(([title, provider, model, input_preview, output_preview], i) => ({
    trace_id: `preview-${i + 1}`,
    title,
    provider,
    model,
    input_preview,
    output_preview,
    publisher: 'Local preview',
    shared_at: now - i * 86400,
    password_protected: false,
    public_url: `${origins.website}/s/preview-${i + 1}`,
  }));
  const page = (items) => ({ items, next_cursor: null });
  return {
    name: 'local-preview-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname;
        if (!path.startsWith('/api/')) return next();
        const send = (data, status = 200) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(data));
        };
        // The preview account is synthetic and always available; mutations fail
        // explicitly instead of implying that a real operation succeeded.
        if (req.method !== 'GET')
          return send(
            {
              error: 'preview_only',
              message: 'This is a local preview. Connect a local API to use this action.',
            },
            503,
          );
        if (path === '/api/account')
          return send({
            account: {
              id: 'local-preview',
              provider_display_name: 'Local preview',
              display_name: 'Local preview',
              auth_provider: 'google',
              avatar_url: null,
              created_at: now,
            },
            billing: {
              plan: 'free',
              billing_status: 'active',
              purchase_mode: 'disabled',
              subscriptions_configured: false,
              entitlements: {
                monthly_capture_bytes: 50_000_000,
                monthly_notarization_bytes: 50_000_000,
                trace_storage_bytes: 1_000_000_000,
              },
            },
          });
        if (path === '/api/usage')
          return send({
            credits: { capture: balance, notarization: balance, reset_at: now + 30 * 86400 },
            operations: { captures: 0, notarizations: 0 },
            hosted_traces: {
              total: 0,
              shared: 0,
              verifying: 0,
              needs_attention: 0,
              stored_bytes: 0,
            },
          });
        if (path === '/api/auth/providers') return send({ google: false, github: false });
        if (['/api/devices', '/api/api-keys', '/api/traces', '/api/credits/history'].includes(path))
          return send(page([]));
        if (path === '/api/credit-offers') return send({ offers: [] });
        if (path === '/api/billing/purchases') return send({ purchases: [] });
        if (path === '/api/registry') return send({ version: 1, generation: 1, notaries: [] });
        if (path === '/api/public/traces') {
          const query = (url.searchParams.get('search') || '').toLowerCase();
          return send(
            page(
              examples.filter(
                (item) =>
                  (!query || JSON.stringify(item).toLowerCase().includes(query)) &&
                  (!url.searchParams.get('provider') ||
                    item.provider === url.searchParams.get('provider')) &&
                  (!url.searchParams.get('shared_after') ||
                    item.shared_at >= Number(url.searchParams.get('shared_after'))),
              ),
            ),
          );
        }
        const match = path.match(/^\/api\/public\/traces\/(preview-[123])(?:\/(.*))?$/);
        const item = examples.find((item) => item.trace_id === match?.[1]);
        if (item && match[2] === 'trace.otlp.json') {
          const attributes = [
            [
              'gen_ai.input.messages',
              [{ role: 'user', parts: [{ type: 'text', content: item.input_preview }] }],
            ],
            [
              'gen_ai.output.messages',
              [{ role: 'assistant', parts: [{ type: 'text', content: item.output_preview }] }],
            ],
          ].map(([key, messages]) => ({ key, value: { stringValue: JSON.stringify(messages) } }));
          return send({
            resourceSpans: [
              {
                scopeSpans: [
                  {
                    spans: [
                      { name: 'Preview conversation', spanId: '0000000000000001', attributes },
                    ],
                  },
                ],
              },
            ],
          });
        }
        if (item && !match[2])
          return send({
            ...item,
            visibility: 'listed',
            host: item.provider === 'openai' ? 'api.openai.com' : 'api.anthropic.com',
            notarized_state: 'preview',
            hosted_verification: 'not_verified',
            content_sha256: 'Preview only',
            package_sha256: 'No evidence package',
            package_size_bytes: 0,
            disclosure_safety_version: 'preview',
            disclosure_safety_override: false,
            trace_url: `/api/public/traces/${item.trace_id}/trace.otlp.json`,
            package_url: `/api/public/traces/${item.trace_id}/package.llmtrace`,
          });
        return send(
          {
            error: 'preview_only',
            message: 'No evidence or live service is available in this local preview.',
          },
          503,
        );
      });
    },
  };
}
