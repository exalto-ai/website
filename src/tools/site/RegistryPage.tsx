import { useEffect, useState } from 'react';
import { abbreviatedKeyId, formatNotaryBoundary, notaryLifecycle, orderNotaries } from '../notaryLifecycle';
import { getRegistry } from '../platform-api/client';
import { sessionDate } from './format';
type HostedRegistry = Awaited<ReturnType<typeof getRegistry>>;
type HostedNotary = HostedRegistry['notaries'][number];
const hostedNotaryStatuses: ReadonlySet<HostedNotary['status']> = new Set([
  'active',
  'retiring',
  'retired',
  'revoked',
]);

function normalizeHostedRegistry(payload: HostedRegistry): HostedRegistry {
  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.format !== 'notary/registry/v1' ||
    !Array.isArray(payload.notaries) ||
    !Number.isSafeInteger(payload.generation) ||
    payload.generation < 0 ||
    typeof payload.active_key_id !== 'string'
  ) {
    throw new Error('malformed');
  }
  if (!payload.notaries.length) {
    if (payload.active_key_id) throw new Error('malformed');
    return { ...payload, notaries: [] };
  }
  const notaries = payload.notaries.map((record) => {
    if (
      !record ||
      typeof record !== 'object' ||
      typeof record.name !== 'string' ||
      !record.name ||
      typeof record.operator !== 'string' ||
      !record.operator ||
      typeof record.host !== 'string' ||
      !record.host ||
      !Number.isInteger(record.port) ||
      record.port < 1 ||
      record.port > 65535 ||
      !['tcp', 'tls'].includes(record.transport) ||
      typeof record.key_id !== 'string' ||
      !record.key_id ||
      typeof record.verification_key !== 'string' ||
      !record.verification_key ||
      !hostedNotaryStatuses.has(record.status) ||
      !Number.isSafeInteger(record.valid_from_unix_ms) ||
      record.valid_from_unix_ms < 0 ||
      ![record.valid_until_unix_ms, record.notarize_until_unix_ms].every(
        (value) =>
          value === null ||
          value === undefined ||
          (Number.isSafeInteger(value) && value >= record.valid_from_unix_ms),
      )
    ) {
      throw new Error('malformed');
    }
    return record;
  });
  const active = notaries.find((record) => record.key_id === payload.active_key_id);
  if (active?.status !== 'active') throw new Error('malformed');
  return { ...payload, notaries: orderNotaries(notaries, payload.active_key_id) };
}

function notaryEndpoint(record: HostedNotary) {
  const host = record.host.includes(':') ? `[${record.host}]` : record.host;
  return `${record.transport}://${host}:${record.port}`;
}

export function HostedNotaryRecord({
  record,
  activeKeyId,
  copiedKeyId,
  onCopy,
  compact = false,
}: {
  record: HostedNotary;
  activeKeyId: string;
  copiedKeyId: string | null;
  onCopy: (keyId: string) => void;
  compact?: boolean;
}) {
  const lifecycle = notaryLifecycle(record.status);
  return (
    <article
      className={`notary-record notary-record--${record.status}${compact ? ' notary-record--compact' : ''}`}
    >
      <header>
        <span className={`notary-state notary-state--${record.status}`}>
          <i aria-hidden="true" />
          {record.status}
        </span>
        {record.key_id === activeKeyId && (
          <span className="notary-selected">Selected by active_key_id</span>
        )}
      </header>
      <h3>{record.name}</h3>
      <p>
        {lifecycle.label}. {lifecycle.description}
      </p>
      <dl>
        <div>
          <dt>Operator</dt>
          <dd>Operated by {record.operator}</dd>
        </div>
        <div>
          <dt>Endpoint</dt>
          <dd>
            <code>{notaryEndpoint(record)}</code>
          </dd>
        </div>
        <div>
          <dt>Transport</dt>
          <dd>{record.transport.toUpperCase()}</dd>
        </div>
        <div className="notary-key-row">
          <dt>
            {record.key_id === activeKeyId ? 'Active verification key' : 'Key ID / fingerprint'}
          </dt>
          <dd>
            <code title={record.key_id}>{abbreviatedKeyId(record.key_id)}</code>
            <button type="button" onClick={() => onCopy(record.key_id)}>
              {copiedKeyId === record.key_id ? 'Copied' : 'Copy full key ID'}
            </button>
          </dd>
        </div>
        {!compact && (
          <>
            <div>
              <dt>Valid from</dt>
              <dd>{formatNotaryBoundary(record.valid_from_unix_ms, { kind: 'lower' })}</dd>
            </div>
            <div>
              <dt>Capture cutoff</dt>
              <dd>{formatNotaryBoundary(record.valid_until_unix_ms)}</dd>
            </div>
            <div>
              <dt>Notarization cutoff</dt>
              <dd>{formatNotaryBoundary(record.notarize_until_unix_ms)}</dd>
            </div>
          </>
        )}
      </dl>
    </article>
  );
}

export function RegistryPage({
  loadRegistry = getRegistry,
}: {
  loadRegistry?: typeof getRegistry;
}) {
  const [registry, setRegistry] = useState<HostedRegistry | null>(null);
  const [error, setError] = useState<'malformed' | 'unavailable' | null>(null);
  const [reload, setReload] = useState(0);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRegistry(null);
    setError(null);
    loadRegistry()
      .then((payload) => {
        if (cancelled) return;
        try {
          setRegistry(normalizeHostedRegistry(payload));
        } catch {
          setError('malformed');
        }
      })
      .catch(() => {
        if (!cancelled) setError('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [loadRegistry, reload]);
  const copyKeyId = async (keyId: string) => {
    await navigator.clipboard.writeText(keyId);
    setCopiedKeyId(keyId);
  };
  const available =
    registry?.notaries.filter(
      (record) => record.key_id === registry.active_key_id || record.status === 'retiring',
    ) || [];
  return (
    <main className="notaries-shell">
      <header className="notaries-intro">
        <span className="eyebrow">Registry</span>
        <h1>Official Notaries</h1>
        <p>
          This is the signing-key lifecycle Registry used by verification. It describes permitted
          protocol work and retained trust records; it does not report endpoint health, uptime, or
          capacity.
        </p>
      </header>
      {registry === null && !error ? (
        <div className="notary-loading" role="status" aria-label="Loading notary Registry">
          <i />
          <i />
          <i />
        </div>
      ) : error ? (
        <section className="notary-page-state" role="alert">
          <h2>
            {error === 'malformed'
              ? 'The notary Registry is malformed'
              : 'The notary Registry is unavailable'}
          </h2>
          <p>
            {error === 'malformed'
              ? 'The response could not be read as a valid signing-key lifecycle Registry. No notary is presented as usable.'
              : 'The public trust metadata could not be loaded. No endpoint status can be inferred from this failure.'}
          </p>
          <button type="button" onClick={() => setReload((value) => value + 1)}>
            Try again
          </button>
        </section>
      ) : registry === null ? null : registry.notaries.length === 0 ? (
        <section className="notary-page-state">
          <h2>No notary records are published</h2>
          <p>
            The Registry contains no trust records. No Capture or Notarization endpoint is presented
            as available.
          </p>
        </section>
      ) : (
        <>
          <section className="notary-section" aria-labelledby="available-notaries">
            <div className="notary-section-heading">
              <div>
                <span className="eyebrow">Protocol lifecycle</span>
                <h2 id="available-notaries">Available for protocol work</h2>
              </div>
              <span>Generation {registry.generation}</span>
            </div>
            <p className="notary-section-note">
              These records describe allowed work within configured time windows. They are not a
              live availability check.
            </p>
            <div className="notary-records notary-records--available">
              {available.length ? (
                available.map((record) => (
                  <HostedNotaryRecord
                    key={record.key_id}
                    record={record}
                    activeKeyId={registry.active_key_id}
                    copiedKeyId={copiedKeyId}
                    onCopy={copyKeyId}
                    compact
                  />
                ))
              ) : (
                <p>No records are designated for new captures or compatible notarizations.</p>
              )}
            </div>
          </section>
          <section className="notary-section notary-history" aria-labelledby="notary-history">
            <div className="notary-section-heading">
              <div>
                <span className="eyebrow">Pinned signing keys</span>
                <h2 id="notary-history">Trust history</h2>
              </div>
              <span>
                {registry.notaries.length} {registry.notaries.length === 1 ? 'record' : 'records'}
              </span>
            </div>
            <div className="notary-records">
              {registry.notaries.map((record) => (
                <HostedNotaryRecord
                  key={record.key_id}
                  record={record}
                  activeKeyId={registry.active_key_id}
                  copiedKeyId={copiedKeyId}
                  onCopy={copyKeyId}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
