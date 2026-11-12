import {
  Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatAgentService } from './chat-agent.service';
import { ChatRequestDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly agent: ChatAgentService) {}

  @Get('status')
  status() {
    return {
      enabled: this.agent.isEnabled(),
      provider: 'groq',
      models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
      features: { toolCalling: true, rag: 'postgres-fts', streaming: 'simulated' },
    };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (data: unknown): void => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const abortController = new AbortController();
    res.on('close', () => abortController.abort());

    try {
      for await (const event of this.agent.run({
        tenantId: user.tenantId,
        userId: user.sub,
        role: user.role,
        messages: dto.messages,
      })) {
        if (abortController.signal.aborted) break;
        send({ type: event.type, data: event.data });
        if (event.type === 'done' || event.type === 'error') break;
      }
    } catch (err) {
      send({ type: 'error', data: { message: err instanceof Error ? err.message : String(err) } });
    } finally {
      res.end();
    }
  }
}