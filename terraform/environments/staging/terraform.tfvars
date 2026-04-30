# AMDOX — Staging Environment
environment        = "staging"
aws_region         = "ap-south-1"
vpc_cidr           = "10.2.0.0/16"

# EKS
eks_node_instance_type = "t3.large"
eks_node_desired_size  = 2
eks_node_min_size      = 1
eks_node_max_size      = 3

# RDS Aurora Serverless v2
db_name            = "amdox_staging"
db_master_username = "amdox_admin"
rds_min_capacity   = 0.5
rds_max_capacity   = 2

# ElastiCache Redis
redis_node_type  = "cache.t3.small"
redis_num_nodes  = 2

alert_email = "devops@amdox.io"
