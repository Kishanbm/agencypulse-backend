import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { MetricsModule } from '../metrics/metrics.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [MetricsModule, CacheModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
