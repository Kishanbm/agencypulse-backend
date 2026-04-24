import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { Agency, Prisma } from '@prisma/client';

@Injectable()
export class AgencyService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyAgency(tenantId: string): Promise<Agency> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: tenantId },
    });

    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  async updateMyAgency(tenantId: string, dto: UpdateAgencyDto): Promise<Agency> {
    // Check slug uniqueness if being changed
    if (dto.slug) {
      const existing = await this.prisma.agency.findUnique({
        where: { slug: dto.slug },
      });
      if (existing && existing.id !== tenantId) {
        throw new ConflictException('This slug is already taken. Choose a different one.');
      }
    }

    // Check custom domain uniqueness if being changed
    if (dto.customDomain) {
      const existing = await this.prisma.agency.findFirst({
        where: { customDomain: dto.customDomain },
      });
      if (existing && existing.id !== tenantId) {
        throw new ConflictException('This custom domain is already in use.');
      }
    }

    try {
      return await this.prisma.agency.update({
        where: { id: tenantId },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.slug && { slug: dto.slug }),
          ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
          ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
          ...(dto.customDomain !== undefined && { customDomain: dto.customDomain }),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('That slug or domain is already taken.');
      }
      throw err;
    }
  }
}
