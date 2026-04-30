# ADR-004: Prophet + LSTM for Financial Forecasting

## Status
**Accepted** — 2024-03-01

## Context
AMDOX ERP needs time-series forecasting for:
- Revenue/expense projections
- Cash flow forecasting
- Inventory demand prediction
- Payroll cost trending

We evaluated:
1. **Prophet (Meta)** — Additive regression, handles seasonality
2. **LSTM (Deep Learning)** — Sequence modeling, complex patterns
3. **ARIMA** — Classical statistical method
4. **Simple Moving Average** — Baseline

## Decision
We chose **Prophet as primary** with **LSTM as secondary** for complex patterns.

## Rationale

### Why Prophet (Primary)
- **Interpretable:** Decomposed into trend + seasonality + holidays. Finance teams understand the components.
- **Handles missing data:** ERP data often has gaps (weekends, holidays). Prophet handles this natively.
- **Seasonality:** Built-in yearly, weekly, daily seasonality. Critical for financial cycles (Q4 spikes, month-end patterns).
- **Robust to outliers:** Financial data has anomalies (one-time payments, refunds). Prophet handles these gracefully.
- **Fast training:** Seconds to train on 3 years of daily data. Good for on-demand forecasting in the API.

### Why LSTM (Secondary)
- **Complex patterns:** Captures non-linear dependencies that Prophet misses.
- **Multi-variate:** Can incorporate multiple input features (economic indicators, inventory levels).
- **Long-term dependencies:** Better for 12+ month forecasts with compounding effects.

### Why NOT ARIMA
- Requires stationary data (needs manual differencing)
- Cannot handle multiple seasonalities
- Poor with missing data
- Less interpretable for non-technical users

### Architecture
```
Forecast Request
      │
      ├── Simple (< 1 year, single variable)
      │     └── Prophet → Fast, interpretable
      │
      └── Complex (multi-variable, long-term)
            └── LSTM → Accurate, slower
```

### Accuracy vs Speed Trade-off
| Model | Training Time | MAPE | Use Case |
|-------|-------------|------|----------|
| Prophet | 2-5 sec | 8-12% | On-demand, dashboard widgets |
| LSTM | 30-60 sec | 5-8% | Batch, monthly reports |
| ARIMA | 1-3 sec | 10-15% | Not selected |

## Consequences
- **Positive:** Accurate forecasting, interpretable results, fast on-demand predictions
- **Negative:** LSTM requires more compute (mitigated by batch processing), model management complexity
- **Dependencies:** Prophet (Python), TensorFlow/PyTorch (LSTM) → isolated in ML Service
