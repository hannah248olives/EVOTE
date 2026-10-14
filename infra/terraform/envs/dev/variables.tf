variable "aws_region" {
  description = "AWS region for the dev environment."
  type        = string
  default     = "eu-north-1"
}

variable "environment" {
  description = "Environment name used in resource names and tags."
  type        = string
  default     = "dev"
}

variable "vpc_cidr_block" {
  description = "CIDR block of the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Create a NAT gateway (~USD 32/month). Not needed until workloads need egress."
  type        = bool
  default     = false
}

variable "database_min_acu" {
  description = "Minimum Aurora Capacity Units (0.5 = always on, lowest cost that stays available)."
  type        = number
  default     = 0.5
}

variable "database_max_acu" {
  description = "Maximum Aurora Capacity Units (cost ceiling for dev)."
  type        = number
  default     = 2
}

variable "cache_node_type" {
  description = "ElastiCache node class."
  type        = string
  default     = "cache.t4g.micro"
}
