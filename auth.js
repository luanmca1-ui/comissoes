import { createRemoteJWKSet, jwtVerify } from 'jose';

function getSiteUrl(event) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host;
  if (!host) {
    throw new Error('Host ausente no request.');
  }
  return `${proto}://${host}`;
}

export async function requireUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      statusCode: 401,
      body: { error: 'Token ausente.' },
    };
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const siteUrl = getSiteUrl(event);
    const issuer = `${siteUrl}/.netlify/identity`;
    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks, { issuer });

    const email = payload.email || payload.sub;
    if (!email) {
      return {
        ok: false,
        statusCode: 401,
        body: { error: 'Token sem e-mail.' },
      };
    }

    return {
      ok: true,
      user: {
        email,
        sub: payload.sub,
      },
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 401,
      body: { error: 'Token inválido.', detail: error.message },
    };
  }
}