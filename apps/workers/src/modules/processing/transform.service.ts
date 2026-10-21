import { Injectable, Logger } from '@nestjs/common';
import jsonata from 'jsonata';

const EVAL_TIMEOUT_MS = 2000;

@Injectable()
export class TransformService {
  private readonly logger = new Logger(TransformService.name);

  async apply(expression: string, input: unknown): Promise<unknown> {
    let compiled: jsonata.Expression;
    try {
      compiled = jsonata(expression);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`JSONata compile error: ${msg}`);
    }

    // JSONata evaluate can be async if the expression uses async
    // functions. We wrap with a timeout to prevent runaway expressions.
    const result = await Promise.race<unknown>([
      compiled.evaluate(input),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`JSONata transform exceeded ${EVAL_TIMEOUT_MS}ms`)),
          EVAL_TIMEOUT_MS,
        ),
      ),
    ]);

    if (result === undefined) {
      // JSONata returns undefined when expression filters everything out.
      // That's a valid transform — emit null so downstream knows it ran.
      return null;
    }

    return result;
  }
}