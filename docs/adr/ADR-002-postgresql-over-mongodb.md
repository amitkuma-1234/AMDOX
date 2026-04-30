# ADR-002: PostgreSQL over MongoDB

## Status
**Accepted** — 2024-01-15

## Context
AMDOX ERP needs a primary database for financial records, employee data, and inventory. We evaluated:

1. **PostgreSQL** — Relational, ACID-compliant, SQL
2. **MongoDB** — Document store, flexible schema, JSON-native

## Decision
We chose **PostgreSQL 17** (Aurora Serverless v2 in production).

## Rationale

### Why PostgreSQL

**1. ACID Transactions (Critical for ERP)**
Financial operations require atomicity:
```sql
BEGIN;
  INSERT INTO gl_entries (debit_account, credit_account, amount) ...;
  UPDATE account_balances SET balance = balance + amount ...;
  INSERT INTO audit_log ...;
COMMIT;
```
MongoDB transactions across collections are slower and have limitations.

**2. Relational Integrity**
ERP data is inherently relational:
- Invoice → Line Items → GL Entries → Fiscal Period
- Employee → Department → Payslips → Leave Balances
Foreign keys and constraints prevent data corruption.

**3. Complex Queries**
Financial reporting requires JOINs, aggregations, window functions:
```sql
SELECT department, SUM(amount), 
       LAG(SUM(amount)) OVER (ORDER BY fiscal_period)
FROM gl_entries
GROUP BY department, fiscal_period;
```

**4. Prisma ORM**
Prisma has first-class PostgreSQL support with type-safe queries, migrations, and schema introspection.

**5. Aurora Serverless v2**
Auto-scales from 0.5 to 128 ACU. Pay-per-use. Multi-AZ failover.

### Why NOT MongoDB
- No multi-document ACID until v4.0 (and still slower than PG)
- Denormalized data leads to update anomalies in ERP context
- No foreign key enforcement → data integrity relies on application layer
- Aggregation pipeline is less expressive than SQL for financial reporting

## Consequences
- **Positive:** Data integrity guaranteed, complex reporting easy, Prisma integration excellent
- **Negative:** Schema migrations required (managed by Prisma Migrate), less flexible for unstructured data
- **Mitigation:** Use JSONB columns for semi-structured data (e.g., custom fields, metadata)
