import { IsUUID } from 'class-validator';

export class StartImpersonationDto {
  @IsUUID()
  tenantId!: string;
}

export class EndImpersonationDto {
  @IsUUID()
  auditLogId!: string;
}