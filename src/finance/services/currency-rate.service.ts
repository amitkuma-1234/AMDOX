import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Currency } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CurrencyRateService {
  private readonly logger = new Logger(CurrencyRateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch latest exchange rates from an external API.
   * Runs daily at midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateExchangeRates() {
    this.logger.log('Updating daily exchange rates...');
    // Implementation for external API call would go here
    // e.g., using axios to fetch from Frankfurter or Fixer
  }

  async convert(amount: number, from: Currency, to: Currency, date: Date = new Date()): Promise<number> {
    if (from === to) return amount;
    
    // Fetch rate from DB for the given date
    const rate = await this.prisma.currencyRate.findFirst({
      where: { fromCurrency: from, toCurrency: to, rateDate: date },
    });

    if (!rate) {
      this.logger.warn(`No exchange rate found for ${from} to ${to} on ${date.toDateString()}`);
      return amount; // Fallback or throw error
    }

    return amount * Number(rate.rate);
  }
}
