import {
  Controller,
  Get,
  Delete,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AssignmentsService } from './assignments.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Portal Users')
@ApiBearerAuth()
@Controller('clients/:clientId/portal-users')
export class PortalUsersController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  // ─── GET /clients/:clientId/portal-users ──────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List CLIENT_USERs with portal access to a client' })
  @Roles(UserRole.AGENCY_ADMIN)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.assignmentsService.listPortalUsers(user, clientId);
  }

  // ─── DELETE /clients/:clientId/portal-users/:userId ───────────────────────

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke portal access for a CLIENT_USER' })
  @Roles(UserRole.AGENCY_ADMIN)
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.assignmentsService.revokePortalUser(user, clientId, userId);
  }
}
