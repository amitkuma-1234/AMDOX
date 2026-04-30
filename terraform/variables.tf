# ============================================================
# AMDOX Terraform Variables
# ============================================================

variable "project" {
  description = "Project name"
  type        = string
  default     = "amdox"
}

variable "environment" {
  description = "Environment (dev, staging, production)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

# ── VPC ────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# ── EKS ────────────────────────────────────────────────────
variable "eks_node_instance_type" {
  description = "EKS node instance type"
  type        = string
  default     = "t3.large"
}

variable "eks_node_desired_size" {
  description = "Desired number of EKS nodes"
  type        = number
  default     = 2
}

variable "eks_node_min_size" {
  description = "Minimum number of EKS nodes"
  type        = number
  default     = 1
}

variable "eks_node_max_size" {
  description = "Maximum number of EKS nodes"
  type        = number
  default     = 5
}

# ── RDS ────────────────────────────────────────────────────
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "amdox"
}

variable "db_master_username" {
  description = "Database master username"
  type        = string
  default     = "amdox_admin"
  sensitive   = true
}

variable "db_master_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

# Aurora Serverless v2 capacity
variable "rds_min_capacity" {
  description = "Aurora Serverless v2 min ACU"
  type        = number
  default     = 0.5
}

variable "rds_max_capacity" {
  description = "Aurora Serverless v2 max ACU"
  type        = number
  default     = 2
}

# ── ElastiCache ────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.medium"
}

variable "redis_num_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 2
}

# ── Alerts ─────────────────────────────────────────────────
variable "alert_email" {
  description = "Email for CloudWatch alerts"
  type        = string
  default     = "devops@amdox.io"
}
