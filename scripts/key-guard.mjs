/**
 * Warns when a script is about to spend the production model key.
 *
 * Testing (the eval, timing runs) should use a separate Google AI Studio
 * project: the deep model's free tier allows about 20 requests a day per
 * project, and one test run can use them all up for every reader. Set
 * PROD_KEY_HASH to the SHA-256 of the production key and this compares
 * against it. The key itself is never printed or stored.
 *
 *   node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "$PROD_KEY"
 */
import { createHash } from 'node:crypto';

export function warnIfProductionKey(key) {
  const expected = process.env.PROD_KEY_HASH?.trim().toLowerCase();
  if (!key) return false;
  if (!expected) {
    console.warn('key-guard: PROD_KEY_HASH is not set, so this run cannot tell whether it is using the production key.');
    return false;
  }
  const actual = createHash('sha256').update(key).digest('hex');
  if (actual !== expected) return false;
  console.warn([
    '',
    '!! This run is using the PRODUCTION model key.',
    '!! Every request here spends the same daily quota as real readers,',
    '!! and deep requests can use up the whole project\'s allowance for today.',
    '!! Put a separate test key in .env (PROVIDER_API_KEY) and run again.',
    '',
  ].join('\n'));
  return true;
}
