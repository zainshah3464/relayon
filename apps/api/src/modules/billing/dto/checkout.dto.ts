import { IsString, Matches } from 'class-validator';

export class CheckoutDto {
  @IsString()
  @Matches(/^price_[a-zA-Z0-9]+$/, {
    message: 'priceId must be a Stripe price ID',
  })
  priceId!: string;
}