import { Module } from '@nestjs/common';
import { AgencyController } from './agency.controller';
import { AgencyService } from './agency.service';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';

@Module({
  controllers: [AgencyController, BrandingController],
  providers: [AgencyService, BrandingService],
  exports: [AgencyService, BrandingService],
})
export class AgencyModule {}
