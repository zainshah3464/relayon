import { Injectable, Logger } from '@nestjs/common';
import jsonata from 'jsonata';

interface RoutingRule {
  when: string;
  destinationIds: string[];
}

export interface RoutingDecision {
  destinationIds: string[];
  matchedRule: number | null;
  reason: string;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  async decide(
    routingRules: unknown,
    destinations: Array<{ id: string }>,
    payload: unknown,
  ): Promise<RoutingDecision> {
    const rules = this.parseRules(routingRules);

    if (rules.length === 0) {
      return {
        destinationIds: destinations.map((d) => d.id),
        matchedRule: null,
        reason: 'no_rules_configured',
      };
    }

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]!;
      try {
        const expr = jsonata(rule.when);
        const result = await expr.evaluate(payload);
        if (result === true) {
          const valid = rule.destinationIds.filter((id) =>
            destinations.some((d) => d.id === id),
          );
          return {
            destinationIds: valid,
            matchedRule: i,
            reason: `rule_${i}_matched`,
          };
        }
      } catch (err) {
        this.logger.warn(
          `routing.rule_${i}_error: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return {
      destinationIds: [],
      matchedRule: null,
      reason: 'no_rule_matched',
    };
  }

  private parseRules(raw: unknown): RoutingRule[] {
    if (!Array.isArray(raw)) return [];
    const out: RoutingRule[] = [];
    for (const item of raw) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as RoutingRule).when === 'string' &&
        Array.isArray((item as RoutingRule).destinationIds)
      ) {
        out.push({
          when: (item as RoutingRule).when,
          destinationIds: (item as RoutingRule).destinationIds.filter(
            (id): id is string => typeof id === 'string',
          ),
        });
      }
    }
    return out;
  }
}