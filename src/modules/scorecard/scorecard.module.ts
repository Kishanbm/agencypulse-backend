import { Module } from '@nestjs/common';
import { ScorecardController } from './scorecard.controller';
import { ScorecardService } from './scorecard.service';
import { MetricsModule } from '../metrics/metrics.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [MetricsModule, CacheModule],
  controllers: [ScorecardController],
  providers: [ScorecardService],
})
export class ScorecardModule {}
