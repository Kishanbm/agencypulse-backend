import { Module } from '@nestjs/common';
import { AgencyOverviewController } from './agency-overview.controller';
import { AgencyOverviewService } from './agency-overview.service';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [AgencyOverviewController],
  providers: [AgencyOverviewService],
})
export class AgencyOverviewModule {}
