variable "name" {
  description = "Cluster identifier and name prefix, e.g. evote-dev."
  type        = string
}

variable "vpc_id" {
  description = "VPC the cluster is created in."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for the DB subnet group (at least two AZs)."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security groups allowed to connect on 5432."
  type        = list(string)
  default     = []
}

variable "database_name" {
  description = "Name of the initial database."
  type        = string
  default     = "evote"
}

variable "master_username" {
  description = "Master username. Use it for migrations only; the API connects as a non-owner role so RLS applies."
  type        = string
  default     = "evote_admin"
}

variable "engine_major_version" {
  description = "Aurora PostgreSQL major version (Charter v5.0 specifies 16)."
  type        = string
  default     = "16"
}

variable "engine_version" {
  description = "Pin an exact engine version. Null uses the AWS default minor for engine_major_version."
  type        = string
  default     = null
}

variable "min_acu" {
  description = "Minimum Aurora Capacity Units. 0.5 is the lowest value that keeps the instance always on."
  type        = number
  default     = 0.5

  validation {
    condition     = var.min_acu >= 0
    error_message = "min_acu must be 0 or greater."
  }
}

variable "max_acu" {
  description = "Maximum Aurora Capacity Units (cost ceiling)."
  type        = number
  default     = 2

  validation {
    condition     = var.max_acu >= 1
    error_message = "max_acu must be at least 1."
  }
}

variable "instance_count" {
  description = "Number of cluster instances (1 = writer only; 2+ adds readers for failover)."
  type        = number
  default     = 1
}

variable "backup_retention_days" {
  description = "Automated backup retention. Production must satisfy RPO <= 5 min via point-in-time restore."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Block deletion of the cluster. Must be true outside dev."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip the final snapshot on destroy. Must be false outside dev."
  type        = bool
  default     = true
}

variable "apply_immediately" {
  description = "Apply modifications immediately instead of in the next maintenance window."
  type        = bool
  default     = true
}
