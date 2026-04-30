/**
 * Domain Events emitted by AMDOX ERP services.
 * Each event follows the pattern: { tenantId, aggregateId, aggregateType, payload, timestamp }
 */

export interface DomainEvent {
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

// ── Finance Events ────────────────────────────────────────────
export class InvoiceCreatedEvent implements DomainEvent {
  static EVENT_TYPE = 'invoice.created';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'Invoice';
  payload: { invoiceNumber: string; amount: number; vendorId?: string; customerId?: string };
  timestamp = new Date();
  userId?: string;
}

export class InvoiceApprovedEvent implements DomainEvent {
  static EVENT_TYPE = 'invoice.approved';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'Invoice';
  payload: { invoiceNumber: string; approvedBy: string };
  timestamp = new Date();
  userId?: string;
}

export class InvoiceMatchedEvent implements DomainEvent {
  static EVENT_TYPE = 'invoice.matched';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'Invoice';
  payload: { invoiceId: string; poId: string; grId: string; matchResult: string };
  timestamp = new Date();
  userId?: string;
}

export class PaymentProcessedEvent implements DomainEvent {
  static EVENT_TYPE = 'payment.processed';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'Payment';
  payload: { paymentId: string; amount: number; vendorId: string };
  timestamp = new Date();
  userId?: string;
}

// ── HR Events ─────────────────────────────────────────────────
export class EmployeeOnboardedEvent implements DomainEvent {
  static EVENT_TYPE = 'employee.onboarded';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'Employee';
  payload: { employeeCode: string; department: string; position: string };
  timestamp = new Date();
  userId?: string;
}

export class LeaveApprovedEvent implements DomainEvent {
  static EVENT_TYPE = 'leave.approved';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'LeaveRequest';
  payload: { employeeId: string; leaveType: string; startDate: string; endDate: string };
  timestamp = new Date();
  userId?: string;
}

// ── SCM Events ────────────────────────────────────────────────
export class PurchaseOrderCreatedEvent implements DomainEvent {
  static EVENT_TYPE = 'purchase_order.created';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'PurchaseOrder';
  payload: { orderNumber: string; vendorId: string; totalAmount: number };
  timestamp = new Date();
  userId?: string;
}

export class GoodsReceivedEvent implements DomainEvent {
  static EVENT_TYPE = 'goods.received';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'GoodsReceipt';
  payload: { receiptNumber: string; poId: string; items: any[] };
  timestamp = new Date();
  userId?: string;
}

// ── Project Events ────────────────────────────────────────────
export class ProjectMilestoneReachedEvent implements DomainEvent {
  static EVENT_TYPE = 'project.milestone_reached';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'Milestone';
  payload: { projectId: string; milestoneName: string; achievedDate: string };
  timestamp = new Date();
  userId?: string;
}

export class TaskOverdueEvent implements DomainEvent {
  static EVENT_TYPE = 'task.overdue';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'ProjectTask';
  payload: { projectId: string; taskTitle: string; dueDate: string; assignedTo: string };
  timestamp = new Date();
  userId?: string;
}

// ── System Events ─────────────────────────────────────────────
export class AlertThresholdBreachedEvent implements DomainEvent {
  static EVENT_TYPE = 'alert.threshold_breached';
  tenantId: string;
  aggregateId: string;
  aggregateType = 'Alert';
  payload: { metric: string; threshold: number; actualValue: number; severity: string };
  timestamp = new Date();
  userId?: string;
}

/** Registry of all event types */
export const DOMAIN_EVENT_TYPES = [
  InvoiceCreatedEvent.EVENT_TYPE,
  InvoiceApprovedEvent.EVENT_TYPE,
  InvoiceMatchedEvent.EVENT_TYPE,
  PaymentProcessedEvent.EVENT_TYPE,
  EmployeeOnboardedEvent.EVENT_TYPE,
  LeaveApprovedEvent.EVENT_TYPE,
  PurchaseOrderCreatedEvent.EVENT_TYPE,
  GoodsReceivedEvent.EVENT_TYPE,
  ProjectMilestoneReachedEvent.EVENT_TYPE,
  TaskOverdueEvent.EVENT_TYPE,
  AlertThresholdBreachedEvent.EVENT_TYPE,
] as const;
