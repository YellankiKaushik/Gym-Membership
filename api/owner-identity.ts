import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyOwnerIdentity } from '../server/owner-identity.ts';
import type { IdentityChallenge } from '../server/owner-identity.ts';

// Identity verifier only, not a generic proxy. No production activation by default.
export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); response.writeHead(405).end('{"success":false}'); return; }
  if (process.env.OWNER_IDENTITY_ENABLED !== 'true') { response.writeHead(503).end('{"success":false}'); return; }
  try {
    let contents: string;
    if (request.body !== undefined) {
      // Vercel can preparse JSON; standalone Node tests provide a raw stream.
      contents = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      if (Buffer.byteLength(contents) > 16384) throw new Error('Invalid request.');
    } else {
      const chunks: Buffer[] = [];
      let size = 0;
      request.setTimeout(10000, () => request.destroy());
      for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > 16384) throw new Error('Invalid request.');
        chunks.push(bytes);
      }
      contents = Buffer.concat(chunks).toString('utf8');
    }
    const data: { idToken: unknown; challenge: IdentityChallenge } = JSON.parse(contents);
    const proof = await verifyOwnerIdentity(data.idToken, data.challenge, process.env);
    response.writeHead(200).end(JSON.stringify({ success: true, proof }));
  } catch {
    // No token, provider error, environment value or request body is logged.
    response.writeHead(401).end('{"success":false,"code":"INVALID_IDENTITY"}');
  }
}
