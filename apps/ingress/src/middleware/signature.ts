import type { RequestHandler } from 'express';
import { config } from '../config';
import { verifySignature } from '../services/verifiers';

export const enforceSignature: RequestHandler = async (req, _res, next) => {
  const workflow = req.workflow;
  if (!workflow) {
    throw new Error('resolveWorkflow must run before enforceSignature');
  }

  await verifySignature({
    sourceType: workflow.sourceType,
    sourceConfig: workflow.sourceConfig,
    rawBody: req.rawBody,
    headers: req.headers,
    toleranceSeconds: config.WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
  });

  next();
};