terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# Resolve AWS's current default Aurora PostgreSQL 16 minor, unless one is pinned explicitly.
data "aws_rds_engine_version" "this" {
  engine                 = "aurora-postgresql"
  parameter_group_family = "aurora-postgresql${var.engine_major_version}"
  default_only           = true
}

locals {
  engine_version = coalesce(var.engine_version, data.aws_rds_engine_version.this.version)
}

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids

  tags = { Name = var.name }
}

resource "aws_security_group" "this" {
  name        = "${var.name}-postgres"
  description = "Aurora PostgreSQL for ${var.name}"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name}-postgres" }
}

resource "aws_vpc_security_group_ingress_rule" "postgres" {
  count = length(var.allowed_security_group_ids)

  security_group_id            = aws_security_group.this.id
  referenced_security_group_id = var.allowed_security_group_ids[count.index]
  description                  = "PostgreSQL from allowed workload security group"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_rds_cluster" "this" {
  cluster_identifier = var.name
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = local.engine_version
  database_name      = var.database_name
  master_username    = var.master_username

  # The password is generated and stored in Secrets Manager by RDS; it never enters Terraform state
  # or the repository.
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]

  storage_encrypted                   = true
  iam_database_authentication_enabled = true
  copy_tags_to_snapshot               = true
  enabled_cloudwatch_logs_exports     = ["postgresql"]

  backup_retention_period   = var.backup_retention_days
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name}-final"
  apply_immediately         = var.apply_immediately

  serverlessv2_scaling_configuration {
    min_capacity = var.min_acu
    max_capacity = var.max_acu
  }

  tags = { Name = var.name }
}

resource "aws_rds_cluster_instance" "this" {
  count = var.instance_count

  identifier           = "${var.name}-${count.index + 1}"
  cluster_identifier   = aws_rds_cluster.this.id
  engine               = aws_rds_cluster.this.engine
  engine_version       = aws_rds_cluster.this.engine_version
  instance_class       = "db.serverless"
  db_subnet_group_name = aws_db_subnet_group.this.name
  publicly_accessible  = false
  apply_immediately    = var.apply_immediately

  tags = { Name = "${var.name}-${count.index + 1}" }
}
