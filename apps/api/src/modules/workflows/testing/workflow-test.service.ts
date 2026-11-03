import { BadRequestException, Injectable } from '@nestjs/common';
import jsonata from 'jsonata';

export interface WorkflowTestStep {
  id: string;
  assert: string;
  description?: string;
}

export interface WorkflowTestResult {
  step: string;
  description: string | null;
  passed: boolean;
  actual: unknown;
  error: string | null;
  durationMs: number;
}

@Injectable()
export class WorkflowTestService {
  async runAssertions(input: {
    transformedPayload: unknown;
    steps: WorkflowTestStep[];
  }): Promise<{
    passed: number;
    failed: number;
    results: WorkflowTestResult[];
  }> {
    if (!Array.isArray(input.steps) || input.steps.length === 0) {
      throw new BadRequestException('steps must be a non-empty array');
    }
    if (input.steps.length > 50) {
      throw new BadRequestException('Maximum 50 assertions per run');
    }

    const results: WorkflowTestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const step of input.steps) {
      const started = Date.now();
      try {
        const expr = jsonata(step.assert);
        const value = await Promise.race([
          expr.evaluate(input.transformedPayload),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('Assertion exceeded 2s')), 2000),
          ),
        ]);
        const ok = Boolean(value);
        if (ok) passed++;
        else failed++;
        results.push({
          step: step.id,
          description: step.description ?? null,
          passed: ok,
          actual: value,
          error: null,
          durationMs: Date.now() - started,
        });
      } catch (err) {
        failed++;
        results.push({
          step: step.id,
          description: step.description ?? null,
          passed: false,
          actual: null,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - started,
        });
      }
    }

    return { passed, failed, results };
  }
}