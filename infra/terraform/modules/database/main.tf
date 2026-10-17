terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# Pick the first available version from an ordered list of PostgreSQL 16 minors, unless one is
# pinned explicitly. AWS's own "default" version is a newer major (17.x), so it must not be used:
# the charter specifies PostgreSQL 16.
data "aws_rds_engine_version" "this" {
  count = var.engine_version == null ? 1 : 0

  engine             = "aurora-postgresql"
  preferred_versions = var.preferred_engine_versions
}

locals {
  engine_version = var.engine_version != null ? var.engine_version : data.aws_rds_engine_version.this[0].version
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

    # With min_acu = 0 the cluster pauses after this many idle seconds and stops billing compute.
    seconds_until_auto_pause = var.min_acu == 0 ? var.auto_pause_seconds : null
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
