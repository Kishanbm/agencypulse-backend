import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CheckoutPlan {
  AGENCY = 'AGENCY',
  AGENCY_PRO = 'AGENCY_PRO',
}

export class CreateCheckoutDto {
  @ApiProperty({ enum: CheckoutPlan, example: CheckoutPlan.AGENCY })
  @IsEnum(CheckoutPlan)
  plan: CheckoutPlan;
}
