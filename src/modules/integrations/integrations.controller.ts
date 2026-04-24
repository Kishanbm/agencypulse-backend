import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IntegrationPlatform, UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { IntegrationsService } from './integrations.service';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto';

@ApiTags('integrations')
@Controller('clients/:clientId/campaigns/:campaignId/integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  // ─── List integrations for a campaign ────────────────────────────────────

  @Get()
  @Roles(UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'List all integrations for a campaign.' })
  @ApiParam({ name: 'clientId', type: String })
  @ApiParam({ name: 'campaignId', type: String })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.integrationsService.listForCampaign(user, clientId, campaignId);
  }

  // ─── Get one integration ──────────────────────────────────────────────────

  @Get(':platform')
  @Roles(UserRole.AGENCY_STAFF)
  @ApiOperation({ summary: 'Get a single integration by platform.' })
  @ApiParam({ name: 'clientId', type: String })
  @ApiParam({ name: 'campaignId', type: String })
  @ApiParam({ name: 'platform', enum: IntegrationPlatform })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('platform') platform: IntegrationPlatform,
  ) {
    return this.integrationsService.findOne(user, clientId, campaignId, platform);
  }

  // ─── Upsert integration ───────────────────────────────────────────────────
  // Creates the connection if it does not exist; updates it if it does.
  // Used during OAuth callback: pass in raw tokens + metadata.
  // Used for status-only updates: omit tokens to keep existing ones.

  @Put()
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Connect or update a platform integration (upsert).' })
  @ApiParam({ name: 'clientId', type: String })
  @ApiParam({ name: 'campaignId', type: String })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: UpsertIntegrationDto,
  ) {
    return this.integrationsService.upsert(user, clientId, campaignId, dto);
  }

  // ─── Disconnect integration ────────────────────────────────────────────────
  // Sets status = DISCONNECTED, clears all stored tokens.
  // Row is kept (not deleted) to preserve audit history.

  @Delete(':platform')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Disconnect a platform integration.' })
  @ApiParam({ name: 'clientId', type: String })
  @ApiParam({ name: 'campaignId', type: String })
  @ApiParam({ name: 'platform', enum: IntegrationPlatform })
  disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('platform') platform: IntegrationPlatform,
  ) {
    return this.integrationsService.disconnect(user, clientId, campaignId, platform);
  }
}
