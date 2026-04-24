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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientQueryDto } from './dto/client-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // ─── POST /clients ────────────────────────────────────────────────────────
  // Only admins can create clients.

  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201, description: 'Client created' })
  @Roles(UserRole.AGENCY_ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.create(user.tenantId, user.id, dto);
  }

  // ─── GET /clients ─────────────────────────────────────────────────────────
  // All roles (including CLIENT_USER) can call this — data scoping in service.
  // CLIENT_USER sees only their assigned clients.

  @Get()
  @ApiOperation({ summary: 'List clients (scoped by role)' })
  @Roles(UserRole.CLIENT_USER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ClientQueryDto,
  ) {
    return this.clientsService.findAll(user, query);
  }

  // ─── GET /clients/:id ─────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single client (scoped by role)' })
  @Roles(UserRole.CLIENT_USER)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.findOne(user, id);
  }

  // ─── PATCH /clients/:id ───────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update client details' })
  @Roles(UserRole.AGENCY_ADMIN)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user, id, dto);
  }

  // ─── DELETE /clients/:id ──────────────────────────────────────────────────
  // Soft delete — sets deletedAt and status=ARCHIVED.
  // Only AGENCY_OWNER can archive clients.

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive (soft-delete) a client' })
  @Roles(UserRole.AGENCY_OWNER)
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.softDelete(user, id);
  }

  // ─── POST /clients/:id/restore ────────────────────────────────────────────

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore an archived client' })
  @Roles(UserRole.AGENCY_OWNER)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clientsService.restore(user, id);
  }
}
