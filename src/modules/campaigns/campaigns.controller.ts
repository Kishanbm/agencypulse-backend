import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Campaigns')
@ApiBearerAuth()
@Controller('clients/:clientId/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  // ─── POST /clients/:clientId/campaigns ────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a campaign for a client' })
  @ApiResponse({ status: 201, description: 'Campaign created' })
  @Roles(UserRole.AGENCY_ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignsService.create(user, clientId, dto);
  }

  // ─── GET /clients/:clientId/campaigns ─────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List campaigns for a client (scoped by role)' })
  @Roles(UserRole.CLIENT_USER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() query: CampaignQueryDto,
  ) {
    return this.campaignsService.findAll(user, clientId, query);
  }

  // ─── GET /clients/:clientId/campaigns/:id ─────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single campaign (scoped by role)' })
  @Roles(UserRole.CLIENT_USER)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.findOne(user, clientId, id);
  }

  // ─── PATCH /clients/:clientId/campaigns/:id ───────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  @Roles(UserRole.AGENCY_ADMIN)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(user, clientId, id, dto);
  }

  // ─── DELETE /clients/:clientId/campaigns/:id ──────────────────────────────
  // Soft delete — sets deletedAt. Only AGENCY_OWNER can delete campaigns.

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a campaign' })
  @Roles(UserRole.AGENCY_OWNER)
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campaignsService.softDelete(user, clientId, id);
  }
}
