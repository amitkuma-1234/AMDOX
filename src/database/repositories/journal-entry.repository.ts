import { Injectable } from '@nestjs/common';
import { JournalEntry, JournalEntryStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class JournalEntryRepository extends BaseRepository<JournalEntry> {
  protected readonly modelName = 'JournalEntry';

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate() {
    return this.prisma.journalEntry;
  }

  async findByReference(reference: string, tenantId: string): Promise<JournalEntry | null> {
    return this.prisma.journalEntry.findFirst({
      where: { reference, tenantId },
      include: { transactions: true },
    });
  }

  async updateStatus(id: string, status: JournalEntryStatus): Promise<JournalEntry> {
    return this.prisma.journalEntry.update({
      where: { id },
      data: { status },
    });
  }

  async findPendingApproval(tenantId: string): Promise<JournalEntry[]> {
    return this.prisma.journalEntry.findMany({
      where: { tenantId, status: 'PENDING_APPROVAL' },
      include: { transactions: { include: { account: true } } },
      orderBy: { entryDate: 'desc' },
    });
  }
}
