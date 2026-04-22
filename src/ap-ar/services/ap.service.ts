import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { VendorRepository } from '../../database/repositories/vendor.repository';
import { GLService } from '../../finance/services/gl.service';
import { CreateApInvoiceDto } from '../dto/ap-ar.dto';
import { TransactionType } from '@prisma/client';

@Injectable()
export class ApService {
  private readonly logger = new Logger(ApService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorRepository: VendorRepository,
    private readonly glService: GLService,
  ) {}

  async findAllVendors(tenantId: string) {
    return this.vendorRepository.findActive(tenantId);
  }

  /**
   * Create an AP Invoice and post to GL.
   * This typically debits an Expense account and credits Accounts Payable.
   */
  async createInvoice(dto: CreateApInvoiceDto, tenantId: string) {
    this.logger.log(`Creating AP invoice: ${dto.invoiceNumber} for vendor ${dto.vendorId}`);

    const vendor = await this.vendorRepository.findById(dto.vendorId, tenantId);
    if (!vendor) throw new NotFoundException(`Vendor ${dto.vendorId} not found`);

    // ── Step 1: Create Invoice ────────────────────────────────
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.apInvoice.create({
        data: {
          ...dto,
          tenantId,
          status: 'APPROVED', // Assuming auto-approval for now
        },
      });

      // ── Step 2: Post to General Ledger ──────────────────────
      // In a real ERP, we'd look up the default GL accounts for the vendor/category
      // For this implementation, we'll assume standard AP and Expense accounts
      
      const apAccount = await tx.account.findFirst({
        where: { tenantId, glCode: '2000' }, // Accounts Payable
      });
      
      const expenseAccount = await tx.account.findFirst({
        where: { tenantId, glCode: '5000' }, // General Expense
      });

      if (apAccount && expenseAccount) {
        await this.glService.createJournalEntry({
          reference: invoice.invoiceNumber,
          description: `AP Invoice: ${invoice.invoiceNumber} - ${vendor.name}`,
          entryDate: dto.invoiceDate,
          lines: [
            { accountId: expenseAccount.id, amount: dto.totalAmount, type: TransactionType.DEBIT },
            { accountId: apAccount.id, amount: dto.totalAmount, type: TransactionType.CREDIT },
          ],
        }, tenantId);
      } else {
        this.logger.warn(`Could not auto-post to GL: Default AP/Expense accounts not found for tenant ${tenantId}`);
      }

      return invoice;
    });
  }
}
