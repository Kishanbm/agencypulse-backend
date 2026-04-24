import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { BrandingService } from './branding.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Branding')
@Controller()
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  // ─── Public ──────────────────────────────────────────────────────────────────

  @Get('branding')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get agency branding for a host (no auth required)',
    description: 'Used by the frontend on initial load to apply agency logo and colors. Resolves the agency from the Host header.',
  })
  getPublicBranding(@Req() req: Request) {
    const host = (req.headers['x-forwarded-host'] ?? req.headers.host ?? '') as string;
    return this.brandingService.getPublicBranding(host);
  }

  // ─── Authenticated ────────────────────────────────────────────────────────────

  @Get('agencies/me/branding')
  @ApiBearerAuth()
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Get own agency branding settings' })
  getMyBranding(@CurrentUser() user: AuthenticatedUser) {
    return this.brandingService.getMyBranding(user.tenantId);
  }

  @Patch('agencies/me/branding')
  @ApiBearerAuth()
  @Roles(UserRole.AGENCY_OWNER)
  @ApiOperation({ summary: 'Update branding colors, custom domain, and email sender' })
  updateBranding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.brandingService.updateBranding(user.tenantId, dto);
  }

  @Post('agencies/me/branding/logo')
  @ApiBearerAuth()
  @Roles(UserRole.AGENCY_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload agency logo (PNG/JPEG/SVG/WebP, max 2 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded. Use multipart field name "file".');
    return this.brandingService.uploadLogo(user.tenantId, file);
  }

  @Post('agencies/me/branding/favicon')
  @ApiBearerAuth()
  @Roles(UserRole.AGENCY_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload agency favicon (ICO/PNG, max 512 KB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 512 * 1024 } }))
  uploadFavicon(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded. Use multipart field name "file".');
    return this.brandingService.uploadFavicon(user.tenantId, file);
  }
}
