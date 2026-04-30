# ============================================================
# AMDOX RDS Aurora Module — PostgreSQL 17 Serverless v2
# ============================================================

variable "project" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "db_name" { type = string }
variable "db_master_username" { type = string }
variable "db_master_password" { type = string }
variable "min_capacity" { type = number }
variable "max_capacity" { type = number }
variable "eks_security_group" { type = string }

# ── Subnet Group ──────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-${var.environment}-db-subnet"
  subnet_ids = var.private_subnet_ids
  tags       = { Name = "${var.project}-db-subnet-group" }
}

# ── Security Group ────────────────────────────────────────
resource "aws_security_group" "rds" {
  name_prefix = "${var.project}-${var.environment}-rds-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.eks_security_group]
    description     = "PostgreSQL from EKS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-rds-sg" }
}

# ── Aurora Cluster (Serverless v2) ────────────────────────
resource "aws_rds_cluster" "main" {
  cluster_identifier     = "${var.project}-${var.environment}"
  engine                 = "aurora-postgresql"
  engine_version         = "17.1"
  engine_mode            = "provisioned"
  database_name          = var.db_name
  master_username        = var.db_master_username
  master_password        = var.db_master_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Serverless v2 scaling
  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }

  # Backup & Recovery
  backup_retention_period   = 30
  preferred_backup_window   = "03:00-04:00"
  copy_tags_to_snapshot     = true
  deletion_protection       = var.environment == "production"
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project}-final-snapshot" : null

  # Encryption
  storage_encrypted = true

  # Multi-AZ
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)

  tags = { Name = "${var.project}-aurora-cluster" }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ── Writer Instance (Serverless v2) ───────────────────────
resource "aws_rds_cluster_instance" "writer" {
  identifier           = "${var.project}-${var.environment}-writer"
  cluster_identifier   = aws_rds_cluster.main.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.main.engine
  engine_version       = aws_rds_cluster.main.engine_version
  db_subnet_group_name = aws_db_subnet_group.main.name

  tags = { Name = "${var.project}-writer" }
}

# ── Read Replica ──────────────────────────────────────────
resource "aws_rds_cluster_instance" "reader" {
  count                = var.environment == "production" ? 1 : 0
  identifier           = "${var.project}-${var.environment}-reader-${count.index}"
  cluster_identifier   = aws_rds_cluster.main.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.main.engine
  engine_version       = aws_rds_cluster.main.engine_version
  db_subnet_group_name = aws_db_subnet_group.main.name

  tags = { Name = "${var.project}-reader-${count.index}" }
}

# ── Outputs ────────────────────────────────────────────────
output "endpoint" { value = aws_rds_cluster.main.endpoint }
output "reader_endpoint" { value = aws_rds_cluster.main.reader_endpoint }
output "port" { value = aws_rds_cluster.main.port }
