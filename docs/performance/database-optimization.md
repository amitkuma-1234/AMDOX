# AMDOX ERP — Database Optimization Guide

## 1. Index Strategy

### B-tree Indexes (Foreign Keys)
All foreign key columns already have indexes via Prisma `@@index` directives. Verify with:
```sql
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
```

### Recommended Additional Indexes
```sql
-- Composite index for tenant-scoped date range queries
CREATE INDEX idx_transactions_tenant_date ON transactions(tenant_id, posting_date DESC);
CREATE INDEX idx_stock_movements_item_date ON stock_movements(inventory_item_id, timestamp DESC);
CREATE INDEX idx_audit_logs_tenant_entity ON audit_logs(tenant_id, entity_type, timestamp DESC);
```

## 2. Materialized Views (BI Dashboard)

```sql
-- Financial summary by tenant (refresh daily)
CREATE MATERIALIZED VIEW mv_financial_summary AS
SELECT
  tenant_id,
  account_type,
  SUM(current_balance) as total_balance,
  COUNT(*) as account_count
FROM accounts
WHERE deleted_at IS NULL AND is_active = true
GROUP BY tenant_id, account_type;

CREATE UNIQUE INDEX ON mv_financial_summary(tenant_id, account_type);

-- Inventory valuation snapshot
CREATE MATERIALIZED VIEW mv_inventory_valuation AS
SELECT
  tenant_id,
  SUM(current_stock * unit_cost) as total_value,
  COUNT(*) as total_items,
  SUM(CASE WHEN stock_status = 'LOW_STOCK' THEN 1 ELSE 0 END) as low_stock_count
FROM inventory_items
WHERE deleted_at IS NULL AND is_active = true
GROUP BY tenant_id;
```

## 3. Query Caching (Redis)
- Dashboard metric queries: 5-minute TTL
- Report data: 1-hour TTL
- ML predictions: 24-hour TTL

## 4. Connection Pooling
Configure PgBouncer with 100 max connections for production:
```ini
[pgbouncer]
pool_mode = transaction
max_client_conn = 200
default_pool_size = 100
```

## 5. Read Replicas
For reporting queries, configure async read replica and route BI queries to it.
