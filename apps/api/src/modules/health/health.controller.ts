import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        db: 'up',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'degraded',
        db: 'down',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      };
    }
  }
}