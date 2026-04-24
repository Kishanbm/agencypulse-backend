import { Module } from '@nestjs/common';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';
import { MetricsModule } from '../metrics/metrics.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [MetricsModule, CacheModule],
  controllers: [KpiController],
  providers: [KpiService],
})
export class KpiModule {}
