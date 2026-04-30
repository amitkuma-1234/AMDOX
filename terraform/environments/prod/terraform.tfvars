# AMDOX — Production Environment
environment        = "production"
aws_region         = "ap-south-1"
vpc_cidr           = "10.0.0.0/16"

# EKS
eks_node_instance_type = "t3.large"
eks_node_desired_size  = 3
eks_node_min_size      = 2
eks_node_max_size      = 6

# RDS Aurora Serverless v2
db_name            = "amdox"
db_master_username = "amdox_admin"
rds_min_capacity   = 1
rds_max_capacity   = 4

# ElastiCache Redis
redis_node_type  = "cache.t3.medium"
redis_num_nodes  = 3

# Alerts
alert_email = "devops@amdox.io"
