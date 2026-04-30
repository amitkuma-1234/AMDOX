# ADR-005: Outbox Pattern for Event Delivery

## Status
**Accepted** — 2024-03-15

## Context
AMDOX ERP modules need to communicate domain events:
- PO approved → Create GRN → Update inventory → Post GL entry
- Payroll completed → Generate payslips → Send notifications
- Invoice created → Update AR balance → Trigger payment workflow

We evaluated:
1. **Outbox Pattern** — Write event to DB table, poll and publish
2. **Direct Event Emission** — Publish to message broker in handler
3. **Change Data Capture (CDC)** — Debezium on DB WAL
4. **Two-Phase Commit** — Distributed transaction

## Decision
We chose the **Transactional Outbox Pattern** with BullMQ as the event transport.

## Rationale

### Why Outbox Pattern

**1. Guaranteed Delivery**
Events are written to the `outbox` table in the same transaction as the business data:
```typescript
async createPurchaseOrder(dto: CreatePODto) {
  return this.prisma.$transaction(async (tx) => {
    // Business operation
    const po = await tx.purchaseOrder.create({ data: dto });
    
    // Event stored in same transaction — atomic
    await tx.outboxEvent.create({
      data: {
        aggregateType: 'PurchaseOrder',
        aggregateId: po.id,
        eventType: 'PO_CREATED',
        payload: JSON.stringify(po),
      },
    });
    
    return po;
  });
}
```
If the transaction fails, neither the PO nor the event is created. No orphaned events.

**2. At-Least-Once Delivery**
A background poller reads unpublished events and pushes them to BullMQ:
```typescript
// Runs every 5 seconds
@Cron('*/5 * * * * *')
async publishOutboxEvents() {
  const events = await this.prisma.outboxEvent.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  
  for (const event of events) {
    await this.queue.add(event.eventType, event.payload);
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: { publishedAt: new Date() },
    });
  }
}
```

**3. Idempotent Consumers**
Events include a unique ID. Consumers track processed IDs to handle duplicates:
```typescript
async handleEvent(event: OutboxEvent) {
  const processed = await this.cache.get(`event:${event.id}`);
  if (processed) return; // Already handled
  
  // Process event...
  await this.cache.set(`event:${event.id}`, '1', 'EX', 86400);
}
```

### Why NOT Direct Emission
```typescript
// DANGEROUS — dual write problem
async createPO(dto) {
  const po = await this.prisma.purchaseOrder.create(dto); // ✅ Succeeds
  await this.queue.add('PO_CREATED', po);                  // ❌ Could fail
  // Result: PO exists but event never published
}
```
If the queue publish fails after DB commit, the event is lost forever.

### Why NOT CDC (Debezium)
- Additional infrastructure (Kafka Connect, Debezium)
- Operational complexity for small team
- Overkill for current event volume (< 1000 events/min)
- Good option for v2 when scale increases

### Why NOT Two-Phase Commit
- Locks resources across systems → performance penalty
- Not supported by most message brokers
- Single point of failure (coordinator)

## Event Flow

```
Business Transaction
       │
       ▼
┌─────────────────┐
│  PostgreSQL     │
│  ┌───────────┐  │
│  │ Business  │  │  Single ACID Transaction
│  │ Tables    │  │
│  ├───────────┤  │
│  │ Outbox    │  │
│  │ Table     │  │
│  └───────────┘  │
└────────┬────────┘
         │ Poll (5s interval)
         ▼
┌─────────────────┐
│  BullMQ (Redis) │
│  Event Queue    │
└────────┬────────┘
         │ Consumer
         ▼
┌─────────────────┐
│  Event Handler  │
│  (Idempotent)   │
└─────────────────┘
```

## Consequences
- **Positive:** Zero event loss, atomic with business operations, simple implementation
- **Negative:** Slight delay (up to 5s polling interval), outbox table grows (mitigated by cleanup job)
- **Monitoring:** Track `outbox_events_pending` metric, alert if backlog > 1000
