import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { PortalUsersController } from './portal-users.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  controllers: [AssignmentsController, PortalUsersController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
