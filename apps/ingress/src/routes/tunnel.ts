import { Router, type Request, type Response } from 'express';
import { captureTunnelWebhook } from '../services/tunnel-capture.service';

export const tunnelRouter = Router();

async function handler(req: Request, res: Response): Promise<void> {
  // ⚠️ Express 5 — params type is `string | string[]`; narrow to string
  const rawId = req.params['sessionId'];
  const sessionId = Array.isArray(rawId) ? (rawId[0] ?? '') : (rawId ?? '');

  if (!sessionId || sessionId.length > 32) {
    res.status(404).json({ error: 'invalid_session' });
    return;
  }

  const rawBody =
    (req as Request & { rawBody?: Buffer }).rawBody ??
    (req.body && typeof req.body === 'object'
      ? Buffer.from(JSON.stringify(req.body))
      : Buffer.from(String(req.body ?? '')));

  try {
    const result = await captureTunnelWebhook(sessionId, {
      method: req.method,
      path: req.path || '/',
      headers: req.headers,
      body: rawBody,
    });

    if (!result.captured) {
      res.status(404).json({
        error: 'tunnel_not_found',
        message: 'Session expired or invalid. Run `npx @relayon/cli listen` again.',
      });
      return;
    }

    // 200 immediately — CLI forwards async to developer's localhost
    res.status(200).json({
      received: true,
      id: result.id,
      sessionId,
      note: 'Received. CLI will forward to your local app.',
    });
  } catch {
    res.status(200).json({ received: false });
  }
}

// ⚠️ Express 5 / path-to-regexp v8 removed support for bare `*` wildcard
// (`/:sessionId/*` throws "Missing parameter name").
// router.use() acts as a prefix matcher — matches /:sessionId AND any sub-path.
tunnelRouter.use('/:sessionId', handler);