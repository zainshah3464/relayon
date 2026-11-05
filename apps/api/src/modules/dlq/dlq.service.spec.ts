import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DlqService } from './dlq.service';

describe('DlqService', () => {
  let service: DlqService;
  let mongo: {
    deliveryModel: {
      find: ReturnType<typeof vi.fn>;
      findOne: ReturnType<typeof vi.fn>;
      updateOne: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      deleteOne: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  // Chainable query helper — mimics mongoose Query .select().lean().exec()
  function chainQuery<T>(result: T) {
    const chain = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(result),
    };
    return chain;
  }

  beforeEach(() => {
    mongo = {
      deliveryModel: {
        find: vi.fn().mockReturnValue(chainQuery([])),
        findOne: vi.fn().mockReturnValue(chainQuery(null)),
        updateOne: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
        deleteOne: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      },
    };
    service = new DlqService(mongo as never);
  });

  describe('list', () => {
    it('filters by status=dlq and tenant', async () => {
      const chain = chainQuery([]);
      mongo.deliveryModel.find.mockReturnValue(chain);

      await service.list('t-1', { limit: 10 });

      expect(mongo.deliveryModel.find).toHaveBeenCalledWith({
        tenantId: 't-1',
        status: 'dlq',
      });
    });

    it('caps limit to 100', async () => {
      const chain = chainQuery([]);
      mongo.deliveryModel.find.mockReturnValue(chain);

      await service.list('t-1', { limit: 500 });

      expect(chain.limit).toHaveBeenCalledWith(101);
    });
  });

  describe('replay', () => {
    it('flips status to pending, clears error', async () => {
      mongo.deliveryModel.findOne.mockReturnValue(
        chainQuery({ _id: 'd-1', tenantId: 't-1', status: 'dlq' }),
      );

      await service.replay('t-1', 'd-1');

      expect(mongo.deliveryModel.updateOne).toHaveBeenCalledWith(
        { _id: 'd-1' },
        {
          $set: {
            status: 'pending',
            attemptCount: 0,
            nextAttemptAt: expect.any(Date),
            error: null,
            dlqReason: null,
            dlqAt: null,
          },
        },
      );
    });

    it('throws 404 for missing entry', async () => {
      mongo.deliveryModel.findOne.mockReturnValue(chainQuery(null));
      await expect(service.replay('t-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bulkReplay', () => {
    it('returns per-ID result, capped at 100', async () => {
      mongo.deliveryModel.find.mockReturnValue(
        chainQuery([{ _id: 'a' }, { _id: 'b' }]),
      );
      mongo.deliveryModel.updateMany.mockResolvedValue({ modifiedCount: 2 });

      const result = await service.bulkReplay('t-1', ['a', 'b', 'not-owned']);

      expect(result.total).toBe(3);
      expect(result.replayed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.failures[0]!.id).toBe('not-owned');
    });

    it('deduplicates input IDs', async () => {
      mongo.deliveryModel.find.mockReturnValue(chainQuery([{ _id: 'a' }]));
      mongo.deliveryModel.updateMany.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.bulkReplay('t-1', ['a', 'a', 'a']);

      expect(result.total).toBe(1);
    });

    it('handles empty input', async () => {
      const result = await service.bulkReplay('t-1', []);
      expect(result.total).toBe(0);
      expect(mongo.deliveryModel.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('bulkDiscard', () => {
    it('deletes atomically with tenant scoping', async () => {
      mongo.deliveryModel.deleteMany.mockResolvedValue({ deletedCount: 3 });

      const result = await service.bulkDiscard('t-1', ['a', 'b', 'c']);

      expect(result.discarded).toBe(3);
      expect(mongo.deliveryModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ['a', 'b', 'c'] },
        tenantId: 't-1',
        status: 'dlq',
      });
    });
  });
});