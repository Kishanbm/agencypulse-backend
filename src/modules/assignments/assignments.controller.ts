import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AssignmentsService } from './assignments.service';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Assignments')
@ApiBearerAuth()
@Controller('clients/:clientId/assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  // ─── GET /clients/:clientId/assignments ───────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List staff assigned to a client' })
  @Roles(UserRole.AGENCY_ADMIN)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.assignmentsService.list(user, clientId);
  }

  // ─── POST /clients/:clientId/assignments ──────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Assign a staff member to a client' })
  @ApiResponse({ status: 201, description: 'Staff member assigned' })
  @Roles(UserRole.AGENCY_ADMIN)
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: AssignStaffDto,
  ) {
    return this.assignmentsService.assign(user, clientId, dto);
  }

  // ─── DELETE /clients/:clientId/assignments/:userId ────────────────────────

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a staff assignment from a client' })
  @Roles(UserRole.AGENCY_ADMIN)
  unassign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.assignmentsService.unassign(user, clientId, userId);
  }
}
