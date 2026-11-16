import { Router, type Request, type Response } from 'express';
import { capturePlaygroundRequest } from '../lib/playground';

export const playRouter = Router();

async function handler(req: Request, res: Response): Promise<void> {
  // ⚠️ Express 5 — params type is `string | string[]`; narrow to string
  const rawId = req.params['sessionId'];
  const sessionId = Array.isArray(rawId) ? (rawId[0] ?? '') : (rawId ?? '');

  if (!sessionId || sessionId.length > 32) {
    res.status(404).json({ error: 'Invalid session' });
    return;
  }

  // Use raw body if express.json captured it; else fall back to parsed body
  const rawBody =
    (req as Request & { rawBody?: Buffer }).rawBody ??
    (req.body && typeof req.body === 'object'
      ? Buffer.from(JSON.stringify(req.body))
      : Buffer.from(String(req.body ?? '')));

  const captured = await capturePlaygroundRequest(sessionId, {
    method: req.method,
    path: req.path || '/',
    headers: req.headers,
    body: rawBody,
  });

  if (!captured) {
    res.status(404).json({ error: 'Session expired or invalid' });
    return;
  }
  res.status(200).json({ captured: true, sessionId });
}

// ⚠️ Express 5 / path-to-regexp v8 removed support for bare `*` wildcard
// (`/:sessionId/*` throws "Missing parameter name").
// router.use() acts as a prefix matcher — matches /:sessionId AND any sub-path.
playRouter.use('/:sessionId', handler);