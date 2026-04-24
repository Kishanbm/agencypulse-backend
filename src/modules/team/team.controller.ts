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
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { TeamService } from './team.service';
import { TokenService } from '../auth/token.service';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ResendInviteDto } from './dto/resend-invite.dto';
import { InviteClientUserDto } from './dto/invite-client-user.dto';
import { ResendClientInviteDto } from './dto/resend-client-invite.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('Team')
@ApiBearerAuth()
@Controller('team')
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly tokenService: TokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all team members (staff + admins)' })
  @Roles(UserRole.AGENCY_ADMIN)
  listTeam(@CurrentUser() user: AuthenticatedUser) {
    return this.teamService.listTeam(user.tenantId);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a new staff member' })
  @Roles(UserRole.AGENCY_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  inviteStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteStaffDto,
  ) {
    return this.teamService.inviteStaff(user.tenantId, user, dto);
  }

  @Post('resend-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invitation email to a pending staff member' })
  @Roles(UserRole.AGENCY_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resendInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResendInviteDto,
  ) {
    return this.teamService.resendInvite(user.tenantId, user, dto);
  }

  // ─── POST /team/accept-invite ─────────────────────────────────────────────
  // Public — no JWT. The invited user has no account yet.
  // Placed here (not in AuthController) to avoid a circular module dependency:
  //   TeamModule imports AuthModule (for PasswordService + TokenService)
  //   → AuthModule cannot also import TeamModule.
  //
  // On success: activates the account AND returns JWT tokens so the user is
  // immediately authenticated — no extra login step required (matches AgencyAnalytics UX).

  @Public()
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Accept invitation, set password, and receive auth tokens' })
  @ApiResponse({ status: 200, description: 'Account activated and JWT returned' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, rawRefreshToken } = await this.teamService.acceptInvite(
      dto,
      req.headers['user-agent'],
      req.ip,
    );

    // Set refresh token as httpOnly cookie — same pattern as login
    res.cookie(REFRESH_COOKIE, rawRefreshToken, this.tokenService.refreshCookieOptions());

    return { accessToken };
  }

  // ─── POST /team/invite-client ─────────────────────────────────────────────
  // Invites a CLIENT_USER and stores pendingClientId on the user record.
  // ClientUserAssignment is created at accept time, not here.

  @Post('invite-client')
  @ApiOperation({ summary: 'Invite a client contact to the portal' })
  @ApiResponse({ status: 201, description: 'Client portal invitation sent' })
  @Roles(UserRole.AGENCY_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  inviteClientUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteClientUserDto,
  ) {
    return this.teamService.inviteClientUser(user.tenantId, user, dto);
  }

  // ─── POST /team/resend-client-invite ──────────────────────────────────────

  @Post('resend-client-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend client portal invitation email' })
  @Roles(UserRole.AGENCY_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resendClientInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResendClientInviteDto,
  ) {
    return this.teamService.resendClientInvite(user.tenantId, user, dto);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a team member (deactivates account)' })
  @Roles(UserRole.AGENCY_OWNER)
  removeTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.teamService.removeTeamMember(user.tenantId, user.id, targetUserId);
  }
}
