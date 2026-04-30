# ============================================================
# AMDOX ElastiCache Module — Redis Cluster
# ============================================================

variable "project" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "node_type" { type = string }
variable "num_cache_nodes" { type = number }
variable "eks_security_group" { type = string }

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project}-${var.environment}-redis-subnet"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.project}-${var.environment}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_security_group]
    description     = "Redis from EKS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-redis-sg" }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project}-${var.environment}"
  description          = "AMDOX Redis cluster"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  engine               = "redis"
  engine_version       = "7.1"
  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  # Failover
  automatic_failover_enabled = var.num_cache_nodes > 1
  multi_az_enabled           = var.num_cache_nodes > 1

  # Maintenance
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_retention_limit = 7
  snapshot_window          = "03:00-04:00"

  tags = { Name = "${var.project}-redis" }
}

output "endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "port" {
  value = aws_elasticache_replication_group.main.port
}
