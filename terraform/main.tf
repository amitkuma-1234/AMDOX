# ============================================================
# AMDOX ERP — Terraform Main Configuration
# ============================================================
# Provider: AWS
# State: S3 backend with DynamoDB lock
# ============================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }

  # S3 backend for remote state
  # Initialize: terraform init -backend-config=environments/<env>/backend.hcl
  backend "s3" {
    bucket         = "amdox-terraform-state"
    key            = "amdox-erp/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "amdox-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "amdox-erp"
      Environment = var.environment
      ManagedBy   = "terraform"
      Team        = "platform"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

# ── Modules ────────────────────────────────────────────────
module "vpc" {
  source = "./modules/vpc"

  project     = var.project
  environment = var.environment
  aws_region  = var.aws_region
  vpc_cidr    = var.vpc_cidr
}

module "eks" {
  source = "./modules/eks"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_instance_type = var.eks_node_instance_type
  node_desired_size  = var.eks_node_desired_size
  node_min_size      = var.eks_node_min_size
  node_max_size      = var.eks_node_max_size
}

module "rds" {
  source = "./modules/rds"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  db_name            = var.db_name
  db_master_username = var.db_master_username
  db_master_password = var.db_master_password
  min_capacity       = var.rds_min_capacity
  max_capacity       = var.rds_max_capacity
  eks_security_group = module.eks.node_security_group_id
}

module "elasticache" {
  source = "./modules/elasticache"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_type          = var.redis_node_type
  num_cache_nodes    = var.redis_num_nodes
  eks_security_group = module.eks.node_security_group_id
}

# ── S3 Bucket for Exports/Backups ──────────────────────────
resource "aws_s3_bucket" "backups" {
  bucket = "${var.project}-${var.environment}-backups"

  tags = {
    Name = "${var.project}-backups"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    id     = "cleanup"
    status = "Enabled"
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    expiration {
      days = 365
    }
  }
}

# ── SNS Topics for Alerts ─────────────────────────────────
resource "aws_sns_topic" "alerts" {
  name = "${var.project}-${var.environment}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── CloudWatch ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "api" {
  name              = "/amdox/${var.environment}/api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/amdox/${var.environment}/web"
  retention_in_days = 30
}

resource "aws_cloudwatch_metric_alarm" "api_cpu" {
  alarm_name          = "${var.project}-${var.environment}-api-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "API CPU > 80% for 10 min"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# ── Outputs ────────────────────────────────────────────────
output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.elasticache.endpoint
  sensitive = true
}

output "s3_backup_bucket" {
  value = aws_s3_bucket.backups.id
}
