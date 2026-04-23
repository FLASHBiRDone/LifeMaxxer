import { serverEnv } from '@/lib/env';

/**
 * Thin wrapper around Google's Gemini image generation API (Nano Banana 2).
 * No SDK — direct REST to keep the runtime light. Returns raw image bytes
 * plus the mime type reported by the model, so callers can decide what
 * to do with them (upload to storage, inline as data URL, etc.).
 */

export type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;
};

export type ImageAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

type GenerateOptions = {
  aspectRatio?: ImageAspectRatio;
  /** Optional override of the model id. Falls back to env. */
  model?: string;
};

/**
 * True when the env has a key configured — callers should guard on this
 * so the meal/training flows keep working when images are disabled.
 */
export function isImageGenConfigured(): boolean {
  return Boolean(serverEnv.GEMINI_API_KEY);
}

export async function generateImage(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<GeneratedImage> {
  const apiKey = serverEnv.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  const model = opts.model ?? serverEnv.GEMINI_IMAGE_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(opts.aspectRatio
        ? { imageConfig: { aspectRatio: opts.aspectRatio } }
        : {}),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // Image gen can take 10-20s on the server side; don't let an
    // intermediate proxy buffer-abort us.
    cache: 'no-store',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Nano Banana 2 error ${res.status}: ${errText.slice(0, 400)}`,
    );
  }
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType: string; data: string };
          inline_data?: { mime_type: string; data: string };
        }>;
      };
    }>;
  };

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  // The API returns either inlineData (new) or inline_data (older).
  const hit = parts.find((p) => p.inlineData || p.inline_data);
  const payload = hit?.inlineData ?? (hit?.inline_data as any);
  if (!payload?.data) {
    console.error('[image-gen] unexpected response shape', JSON.stringify(json).slice(0, 400));
    throw new Error('Nano Banana 2 returned no image');
  }
  return {
    bytes: Buffer.from(payload.data, 'base64'),
    mimeType: payload.mimeType ?? payload.mime_type ?? 'image/png',
  };
}
