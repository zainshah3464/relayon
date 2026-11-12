import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiAdminController } from './ingest.controller';
import { ChatAgentService } from './chat-agent.service';
import { KnowledgeService } from './knowledge.service';
import { RagService } from './rag.service';

@Module({
  controllers: [AiController, AiAdminController],
  providers: [ChatAgentService, KnowledgeService, RagService],
  exports: [KnowledgeService, RagService],
})
export class AiModule {}