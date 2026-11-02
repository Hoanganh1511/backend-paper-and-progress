import { createHmac, timingSafeEqual } from 'node:crypto';

/** Copies `value` with the keys of every object sorted A to Z, the way Casso builds the text it signs. */
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** Reads `t=<timestamp>,v1=<hex>` from the `X-Casso-Signature` header. */
function parseHeader(header: string | undefined) {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }),
  );
  return parts.t && parts.v1 ? { t: parts.t, v1: parts.v1 } : null;
}

/**
 * Checks a Casso Webhook V2 call: the signature is an HMAC-SHA512, with the
 * integration's key, of `<t>.<JSON of the data with sorted keys>`. Casso's
 * docs say "the webhook data" without saying whether that is the whole body
 * or its `data` field, so both are tried; a forger needs the key either way.
 */
export function verifyCassoSignature(
  header: string | undefined,
  body: unknown,
  key: string,
): boolean {
  const parsed = parseHeader(header);
  if (!parsed || !key) return false;
  const given = Buffer.from(parsed.v1, 'hex');
  const candidates: unknown[] = [body];
  if (body !== null && typeof body === 'object' && 'data' in body) {
    candidates.push((body as { data: unknown }).data);
  }
  return candidates.some((candidate) => {
    const expected = createHmac('sha512', key)
      .update(`${parsed.t}.${JSON.stringify(sortKeys(candidate))}`)
      .digest();
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
