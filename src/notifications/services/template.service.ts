import { Injectable, Logger } from '@nestjs/common';

/**
 * Mustache-style template engine for notifications.
 * Supports per-event templates and multi-language (i18n).
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  private readonly templates: Record<string, { title: string; body: string }> = {
    'invoice.created': {
      title: 'New Invoice Created',
      body: 'Invoice {{invoiceNumber}} has been created for {{amount}}.',
    },
    'invoice.approved': {
      title: 'Invoice Approved',
      body: 'Invoice {{invoiceNumber}} has been approved by {{approvedBy}}.',
    },
    'invoice.matched': {
      title: 'Invoice Matched',
      body: 'Invoice {{invoiceId}} has been matched with PO {{poId}} and GR {{grId}}. Result: {{matchResult}}.',
    },
    'payment.processed': {
      title: 'Payment Processed',
      body: 'Payment of {{amount}} has been processed for vendor {{vendorId}}.',
    },
    'employee.onboarded': {
      title: 'New Employee Onboarded',
      body: 'Employee {{employeeCode}} has joined the {{department}} department as {{position}}.',
    },
    'leave.approved': {
      title: 'Leave Request Approved',
      body: 'Leave request ({{leaveType}}) from {{startDate}} to {{endDate}} has been approved.',
    },
    'purchase_order.created': {
      title: 'Purchase Order Created',
      body: 'PO {{orderNumber}} has been created for vendor {{vendorId}} totaling {{totalAmount}}.',
    },
    'goods.received': {
      title: 'Goods Received',
      body: 'Goods receipt {{receiptNumber}} recorded for PO {{poId}}.',
    },
    'project.milestone_reached': {
      title: 'Milestone Achieved! 🎯',
      body: 'Project milestone "{{milestoneName}}" has been achieved on {{achievedDate}}.',
    },
    'task.overdue': {
      title: '⚠️ Task Overdue',
      body: 'Task "{{taskTitle}}" was due on {{dueDate}} and is now overdue. Assigned to: {{assignedTo}}.',
    },
    'alert.threshold_breached': {
      title: '🚨 Alert: Threshold Breached',
      body: 'Metric {{metric}} has breached its threshold. Threshold: {{threshold}}, Actual: {{actualValue}}. Severity: {{severity}}.',
    },
  };

  /**
   * Render a template with the given data (Mustache-style {{ variable }}).
   */
  render(eventType: string, data: Record<string, any>, lang: string = 'en'): { title: string; body: string } {
    const template = this.templates[eventType];
    if (!template) {
      this.logger.warn(`No template found for event type: ${eventType}`);
      return { title: `Event: ${eventType}`, body: JSON.stringify(data) };
    }

    return {
      title: this.interpolate(template.title, data),
      body: this.interpolate(template.body, data),
    };
  }

  private interpolate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }
}
