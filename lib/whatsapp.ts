/**
 * WhatsApp Business Cloud API client (Meta direct).
 *
 * For faster setup, swap this for Wati/Interakt — they expose similar methods.
 * API docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const GRAPH_VERSION = 'v21.0';

function baseUrl() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID missing');
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}`;
}

function authHeaders() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN missing');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'text',
      text: { body },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${err}`);
  }
}

/**
 * Download a media file (e.g. voice note) from a WhatsApp media ID.
 * WhatsApp voice notes come as .ogg files.
 */
export async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  // Step 1: get the media URL
  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) {
    throw new Error(`Failed to get media metadata: ${metaRes.status}`);
  }
  const meta = await metaRes.json();

  // Step 2: download the actual file (requires auth header)
  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) {
    throw new Error(`Failed to download media: ${fileRes.status}`);
  }
  return Buffer.from(await fileRes.arrayBuffer());
}

/**
 * Verify webhook subscription (Meta requires this on setup).
 */
export function verifyWebhook(mode: string | null, token: string | null, challenge: string | null): string | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }
  return null;
}
