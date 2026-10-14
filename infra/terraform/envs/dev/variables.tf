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

variable "enable_database" {
  description = "Create the Aurora PostgreSQL cluster. It is billed per hour; set false for a zero-cost sandbox (network only)."
  type        = bool
  default     = true
}

variable "enable_cache" {
  description = "Create the ElastiCache Redis group and its secret. Billed per hour and it cannot pause: leave false and use the local Docker Redis, enable only for a short integration test, then destroy."
  type        = bool
  default     = false
}

variable "database_min_acu" {
  description = "Minimum Aurora Capacity Units. 0 = auto-pause when idle (least cost, first connection after a pause is slow). 0.5 = always on."
  type        = number
  default     = 0
}

variable "database_backup_retention_days" {
  description = "Automated backup retention in days (1 is the minimum). Dev data is disposable."
  type        = number
  default     = 1
}

variable "database_max_acu" {
  description = "Maximum Aurora Capacity Units. This is the cost ceiling: 1 ACU is enough for development."
  type        = number
  default     = 1
}

variable "cache_node_type" {
  description = "ElastiCache node class."
  type        = string
  default     = "cache.t4g.micro"
}
