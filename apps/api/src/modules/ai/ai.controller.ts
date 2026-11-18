import {
  Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatAgentService } from './chat-agent.service';
import { ChatRequestDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator';
import { ProviderKeyResolver } from '../integrations/provider-resolver';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly agent: ChatAgentService,
    private readonly keys: ProviderKeyResolver,
  ) {}

  @Get('status')
  async status(@CurrentUser() user: JwtUser) {
    const resolved = await this.keys.resolve(user.tenantId, 'groq');
    return {
      enabled: resolved !== null,
      provider: 'groq',
      model: resolved?.model ?? 'openai/gpt-oss-120b',
      keySource: resolved?.source ?? 'none',
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