import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';

export const resolveWorkflow: RequestHandler = async (req, _res, next) => {
  // Express 5: req.params values are `string | string[]`. Normalize
  // to a plain string — our routes never produce arrays.
  const rawTenantId = req.params.tenantId;
  const rawWorkflowId = req.params.workflowId;
  const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
  const workflowId = Array.isArray(rawWorkflowId) ? rawWorkflowId[0] : rawWorkflowId;

  if (!tenantId || !workflowId) {
    throw new NotFoundError('Workflow not found');
  }

  const workflow = await prisma.workflow.findFirst({
    where: {
      id: workflowId,
      tenantId,
      isActive: true,
    },
    select: {
      id: true,
      tenantId: true,
      sourceType: true,
      sourceConfig: true,
    },
  });

  if (!workflow) {
    // Uniform 404 — don't leak whether the workflow exists but is disabled
    throw new NotFoundError('Workflow not found');
  }

  req.workflow = {
    id: workflow.id,
    tenantId: workflow.tenantId,
    sourceType: workflow.sourceType,
    sourceConfig: (workflow.sourceConfig ?? {}) as Record<string, unknown>,
  };

  next();
};