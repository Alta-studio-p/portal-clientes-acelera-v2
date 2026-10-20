import pg from 'pg';

// Public trust anchor distributed by Supabase, not a credential.
// https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json
const SUPABASE_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

/** @param {pg.Pool | pg.PoolClient} connection */
function queries(connection) {
  /** @param {string} text @param {unknown[]} [values] */
  async function query(text, values = []) {
    const result = await connection.query(text, values);
    return /** @type {Record<string, unknown>[]} */ (result.rows);
  }
  /** @param {TemplateStringsArray} strings @param {unknown[]} values */
  function sql(strings, ...values) {
    if (!Array.isArray(strings.raw)) throw new Error('Use a SQL template or sql.query with parameters.');
    const text = strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, '');
    return query(text, values);
  }
  sql.query = query;
  return sql;
}

/** @param {string | undefined} [databaseUrl] */
export function createSqlClient(databaseUrl = process.env.SUPABASE_DATABASE_URL) {
  if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL no esta configurada.');
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !/\.(supabase\.com|supabase\.co)$/.test(url.hostname)) {
    throw new Error('SUPABASE_DATABASE_URL debe apuntar a Supabase.');
  }
  // URL SSL flags override pg's explicit CA configuration; always verify TLS.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: SUPABASE_CA },
    max: 3,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000,
    query_timeout: 30000,
    allowExitOnIdle: true,
    types: {
      getTypeParser(oid, format) {
        // Preserve the string dates expected by the existing SQL data layer.
        if (format !== 'binary' && [1082, 1114, 1184].includes(oid)) return value => value;
        return pg.types.getTypeParser(oid, format);
      },
    },
  });
  pool.on('error', () => console.error('Supabase: idle database connection closed.'));
  const sql = queries(pool);
  /** @template T @param {(sql: ReturnType<typeof queries>) => Promise<T>} work */
  async function transaction(work) {
    const client = await pool.connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      const result = await work(queries(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      throw error;
    } finally {
      client.release(discard);
    }
  }
  return Object.assign(sql, { transaction, end: () => pool.end() });
}
