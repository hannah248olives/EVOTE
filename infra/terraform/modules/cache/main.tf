terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

locals {
  parameter_group_family = "${var.engine}${split(".", var.engine_version)[0]}"
  multi_node             = var.node_count > 1
}

resource "aws_elasticache_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids

  tags = { Name = var.name }
}

resource "aws_security_group" "this" {
  name        = "${var.name}-redis"
  description = "ElastiCache Redis for ${var.name}"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name}-redis" }
}

resource "aws_vpc_security_group_ingress_rule" "redis" {
  count = length(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = var.allowed_security_group_ids[count.index]
  description                  = "Redis from allowed workload security group"
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}

# ElastiCache AUTH tokens only allow a restricted character set, hence no special characters.
resource "random_password" "auth_token" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "auth_token" {
  name                    = "${var.name}/redis/auth-token"
  description             = "AUTH token for the ${var.name} Redis replication group"
  recovery_window_in_days = var.secret_recovery_window_days

  tags = { Name = "${var.name}-redis-auth-token" }
}

resource "aws_secretsmanager_secret_version" "auth_token" {
  secret_id     = aws_secretsmanager_secret.auth_token.id
  secret_string = random_password.auth_token.result
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = var.name
  description          = "Live tally, pub/sub and BullMQ queues for ${var.name}"

  engine               = var.engine
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_clusters   = var.node_count
  port                 = 6379
  parameter_group_name = "default.${local.parameter_group_family}"

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.this.id]

  automatic_failover_enabled = local.multi_node
  multi_az_enabled           = local.multi_node

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.auth_token.result

  snapshot_retention_limit = var.snapshot_retention_days
  apply_immediately        = var.apply_immediately

  tags = { Name = var.name }
}
