# AMDOX ERP — Deployment Guide

## Prerequisites

- AWS Account with admin access
- `kubectl` CLI installed
- `helm` v3.14+ installed
- `terraform` v1.7+ installed
- Docker & Docker Compose
- AWS CLI configured (`aws configure`)

## Step-by-Step Deployment

### 1. Create AWS Infrastructure (Terraform)

```bash
cd terraform

# Initialize Terraform
terraform init -backend-config=environments/prod/backend.hcl

# Review plan
terraform plan -var-file=environments/prod/terraform.tfvars

# Apply (creates VPC, EKS, RDS, ElastiCache, S3)
terraform apply -var-file=environments/prod/terraform.tfvars
```

**Resources created:**
- VPC with public/private subnets across 3 AZs
- EKS cluster with managed node group (3x t3.large)
- Aurora PostgreSQL 17 Serverless v2 (writer + reader)
- ElastiCache Redis cluster (3 nodes)
- S3 bucket for backups
- CloudWatch log groups and alarms

### 2. Configure kubeconfig

```bash
aws eks update-kubeconfig --name amdox-production --region ap-south-1
kubectl get nodes  # Verify cluster access
```

### 3. Deploy Helm Chart

```bash
# Add required Helm repos
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Create namespace
kubectl create namespace amdox-production

# Create secrets (use SealedSecrets in production)
kubectl create secret generic amdox-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=redis-password="..." \
  --from-literal=jwt-secret="..." \
  -n amdox-production

# Install AMDOX
helm install amdox charts/amdox-erp \
  -f charts/amdox-erp/values-prod.yaml \
  -n amdox-production

# Verify
helm list -n amdox-production
kubectl get pods -n amdox-production
```

### 4. Configure DNS & SSL

```bash
# Get ingress external IP
kubectl get ingress -n amdox-production

# Create DNS records in Route 53:
# api.amdox.io   → ALB endpoint
# app.amdox.io   → ALB endpoint

# cert-manager will auto-provision Let's Encrypt TLS
kubectl get certificates -n amdox-production
```

### 5. Verify Deployment

```bash
# Health checks
curl https://api.amdox.io/health/live
curl https://api.amdox.io/health/ready

# Run smoke tests
# k6 run tests/k6/smoke.js

# Check pod status
kubectl get pods -n amdox-production -o wide
kubectl top pods -n amdox-production
```

## Troubleshooting

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| Pods stuck in `Pending` | `kubectl describe pod <name>` | Check node resources, scale node group |
| `CrashLoopBackOff` | `kubectl logs <pod> --previous` | Check env vars, DB connectivity |
| Ingress not working | `kubectl describe ingress` | Verify DNS, cert-manager, annotations |
| DB connection refused | Check security groups | Ensure EKS SG can reach RDS SG on 5432 |
| High latency | Check Grafana dashboards | Scale replicas, check DB slow queries |

## Scaling

### Horizontal (more pods)
```bash
# Manual
kubectl scale deployment amdox-api --replicas=5 -n amdox-production

# Automatic (HPA already configured)
kubectl get hpa -n amdox-production
```

### Vertical (bigger nodes)
```bash
# Update terraform
# eks_node_instance_type = "t3.xlarge"
terraform apply -var-file=environments/prod/terraform.tfvars
```

### Database
```bash
# Aurora auto-scales (Serverless v2)
# Adjust capacity: rds_min_capacity = 2, rds_max_capacity = 8
terraform apply -var-file=environments/prod/terraform.tfvars
```

## Upgrade Process (Blue-Green)

1. Tag new release: `git tag v1.2.0 && git push --tags`
2. CI/CD builds & pushes images
3. Deploy to staging (automatic via ArgoCD)
4. Run smoke tests on staging
5. Manual approval → deploy to production
6. Canary: 10% traffic to new version
7. Monitor 2 minutes (error rate < 2%)
8. Full rollout (100% traffic)

### Rollback
```bash
# Helm rollback
helm rollback amdox 1 -n amdox-production

# Kubernetes rollback
kubectl rollout undo deployment/amdox-api -n amdox-production
```

## Cost Estimation (Production)

| Resource | Specification | Monthly Cost (est.) |
|----------|--------------|-------------------|
| EKS Cluster | Control plane | $73 |
| EC2 Nodes | 3x t3.large | $180 |
| Aurora PostgreSQL | Serverless v2 (1-4 ACU) | $100-400 |
| ElastiCache Redis | 3x cache.t3.medium | $135 |
| ALB | Application Load Balancer | $25 |
| NAT Gateway | Single AZ | $45 |
| S3 + CloudWatch | Storage + logs | $20 |
| **Total** | | **~$578-878/mo** |
