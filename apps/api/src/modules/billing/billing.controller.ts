import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly stripe: StripeService,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: JwtUser) {
    return this.billing.getStatus(user.tenantId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(
    @CurrentUser() user: JwtUser,
    @Body() dto: CheckoutDto,
    @Headers('origin') origin: string,
  ) {
    return this.billing.createCheckout(
      user.tenantId,
      user.email,
      dto.priceId,
      origin || process.env['APP_ORIGIN'] || 'http://localhost:4200',
    );
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  portal(@CurrentUser() user: JwtUser, @Headers('origin') origin: string) {
    return this.billing.createPortal(
      user.tenantId,
      origin || process.env['APP_ORIGIN'] || 'http://localhost:4200',
    );
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const event = this.stripe.constructWebhookEvent(
      req.rawBody ?? Buffer.from(''),
      signature,
    );
    await this.billing.handleWebhook(
      event as unknown as {
        type: string;
        data: { object: Record<string, unknown> };
      },
    );
    return { received: true };
  }
}