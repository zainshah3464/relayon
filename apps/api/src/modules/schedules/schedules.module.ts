import { Module } from '@nestjs/common';
import { SchedulesController } from './schedules.controller';
import { SchedulesBulkController } from './schedules-bulk.controller';
import { SchedulesService } from './schedules.service';

@Module({
  controllers: [SchedulesController, SchedulesBulkController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}