import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

const ADMIN_ROLES: UserRole[] = [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN];

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: CreateNoteDto,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    return (this.prisma as any).campaignNote.create({
      data: {
        tenantId: user.tenantId,
        campaignId,
        authorId: user.id,
        body: dto.body,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
  }

  async list(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);

    return (this.prisma as any).campaignNote.findMany({
      where: { tenantId: user.tenantId, campaignId, deletedAt: null },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
  }

  async update(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    noteId: string,
    dto: UpdateNoteDto,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);
    const note = await this.findNote(user.tenantId, campaignId, noteId);

    // Non-admins can only edit their own notes; isPinned is admin-only
    const isAdmin = ADMIN_ROLES.includes(user.role as UserRole);
    if (!isAdmin && note.authorId !== user.id) {
      throw new ForbiddenException('You can only edit your own notes.');
    }
    if (dto.isPinned !== undefined && !isAdmin) {
      throw new ForbiddenException('Only admins can pin notes.');
    }

    return (this.prisma as any).campaignNote.update({
      where: { id: noteId },
      data: {
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
  }

  async remove(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    noteId: string,
  ) {
    await this.assertCampaignAccess(user, clientId, campaignId);
    const note = await this.findNote(user.tenantId, campaignId, noteId);

    const isAdmin = ADMIN_ROLES.includes(user.role as UserRole);
    if (!isAdmin && note.authorId !== user.id) {
      throw new ForbiddenException('You can only delete your own notes.');
    }

    await (this.prisma as any).campaignNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async findNote(tenantId: string, campaignId: string, noteId: string) {
    const note = await (this.prisma as any).campaignNote.findFirst({
      where: { id: noteId, tenantId, campaignId, deletedAt: null },
    });
    if (!note) throw new NotFoundException('Note not found.');
    return note;
  }

  private async assertCampaignAccess(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
  ) {
    const isClient = user.role === UserRole.CLIENT_USER;
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        clientId,
        tenantId: user.tenantId,
        deletedAt: null,
        ...(isClient && {
          client: { clientUserAssignments: { some: { userId: user.id } } },
        }),
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
  }
}
