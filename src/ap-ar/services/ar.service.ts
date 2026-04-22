import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GLService } from '../../finance/services/gl.service';
import { CreateArInvoiceDto } from '../dto/ap-ar.dto';
import { TransactionType } from '@prisma/client';

@Injectable()
export class ArService {
  private readonly logger = new Logger(ArService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly glService: GLService,
  ) {}

  async findAllInvoices(tenantId: string) {
    return this.prisma.arInvoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create an AR Invoice and post to GL.
   * This typically debits Accounts Receivable and credits Sales Revenue.
   */
  async createInvoice(dto: CreateArInvoiceDto, tenantId: string) {
    this.logger.log(`Creating AR invoice: ${dto.invoiceNumber} for ${dto.customerName}`);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.arInvoice.create({
        data: {
          ...dto,
          tenantId,
          status: 'APPROVED',
        },
      });

      // ── Step 2: Post to General Ledger ──────────────────────
      const arAccount = await tx.account.findFirst({
        where: { tenantId, glCode: '1100' }, // Accounts Receivable
      });
      
      const salesAccount = await tx.account.findFirst({
        where: { tenantId, glCode: '4000' }, // Sales Revenue
      });

      if (arAccount && salesAccount) {
        await this.glService.createJournalEntry({
          reference: invoice.invoiceNumber,
          description: `AR Invoice: ${invoice.invoiceNumber} - ${dto.customerName}`,
          entryDate: dto.invoiceDate,
          lines: [
            { accountId: arAccount.id, amount: dto.totalAmount, type: TransactionType.DEBIT },
            { accountId: salesAccount.id, amount: dto.totalAmount, type: TransactionType.CREDIT },
          ],
        }, tenantId);
      } else {
        this.logger.warn(`Could not auto-post to GL: Default AR/Sales accounts not found for tenant ${tenantId}`);
      }

      return invoice;
    });
  }
}
