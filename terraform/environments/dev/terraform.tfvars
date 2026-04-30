# AMDOX — Development Environment
environment        = "dev"
aws_region         = "ap-south-1"
vpc_cidr           = "10.1.0.0/16"

# EKS
eks_node_instance_type = "t3.medium"
eks_node_desired_size  = 1
eks_node_min_size      = 1
eks_node_max_size      = 2

# RDS Aurora Serverless v2
db_name            = "amdox_dev"
db_master_username = "amdox_admin"
rds_min_capacity   = 0.5
rds_max_capacity   = 1

# ElastiCache Redis
redis_node_type  = "cache.t3.micro"
redis_num_nodes  = 1

alert_email = "dev@amdox.io"
