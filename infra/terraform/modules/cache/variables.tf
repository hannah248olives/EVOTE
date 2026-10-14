variable "name" {
  description = "Replication group ID and name prefix, e.g. evote-dev."
  type        = string
}

variable "vpc_id" {
  description = "VPC the cache is created in."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for the cache subnet group."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security groups allowed to connect on 6379."
  type        = list(string)
  default     = []
}

variable "engine" {
  description = "Cache engine: redis (OSS, up to 7.1) or valkey (7.2+, Redis-compatible)."
  type        = string
  default     = "redis"

  validation {
    condition     = contains(["redis", "valkey"], var.engine)
    error_message = "engine must be \"redis\" or \"valkey\"."
  }
}

variable "engine_version" {
  description = "Engine version. ElastiCache Redis OSS tops out at 7.1; Charter v5.0 names 7.2 (see README)."
  type        = string
  default     = "7.1"
}

variable "node_type" {
  description = "Instance class of each cache node."
  type        = string
  default     = "cache.t4g.micro"
}

variable "node_count" {
  description = "Number of nodes. 1 = no replica (dev). 2+ enables Multi-AZ failover."
  type        = number
  default     = 1
}

variable "snapshot_retention_days" {
  description = "Days to keep automatic snapshots (0 disables them)."
  type        = number
  default     = 1
}

variable "secret_recovery_window_days" {
  description = "Secrets Manager recovery window. 0 deletes immediately (dev only); 7-30 elsewhere."
  type        = number
  default     = 7
}

variable "apply_immediately" {
  description = "Apply modifications immediately instead of in the next maintenance window."
  type        = bool
  default     = true
}
