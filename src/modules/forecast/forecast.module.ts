import { Module } from '@nestjs/common';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { MetricsModule } from '../metrics/metrics.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [MetricsModule, CacheModule],
  controllers: [ForecastController],
  providers: [ForecastService],
})
export class ForecastModule {}
