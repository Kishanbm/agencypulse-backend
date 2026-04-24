import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AgencyService } from './agency.service';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Agency')
@ApiBearerAuth()
@Controller('agencies')
export class AgencyController {
  constructor(private readonly agencyService: AgencyService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own agency details' })
  // AGENCY_ADMIN+ can view (AGENCY_STAFF and CLIENT_USER cannot see agency settings)
  @Roles(UserRole.AGENCY_ADMIN)
  getMyAgency(@CurrentUser() user: AuthenticatedUser) {
    return this.agencyService.getMyAgency(user.tenantId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update agency profile (name, slug, branding)' })
  // Only the AGENCY_OWNER can change the agency profile
  @Roles(UserRole.AGENCY_OWNER)
  updateMyAgency(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAgencyDto,
  ) {
    return this.agencyService.updateMyAgency(user.tenantId, dto);
  }
}
