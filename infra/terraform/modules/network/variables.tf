variable "name" {
  description = "Name prefix for every resource, e.g. evote-dev."
  type        = string
}

variable "cidr_block" {
  description = "IPv4 CIDR of the VPC. Must be at least a /16 so it can be split into 16 subnets."
  type        = string
  default     = "10.20.0.0/16"

  validation {
    condition     = can(cidrhost(var.cidr_block, 0)) && tonumber(split("/", var.cidr_block)[1]) <= 16
    error_message = "cidr_block must be a valid IPv4 CIDR with a prefix of /16 or larger."
  }
}

variable "az_count" {
  description = "Number of availability zones to spread subnets across."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count must be 2 or 3 (Aurora and ElastiCache subnet groups need at least two AZs)."
  }
}

variable "enable_nat_gateway" {
  description = "Create a single NAT gateway so private subnets can reach the internet (costs money)."
  type        = bool
  default     = false
}
