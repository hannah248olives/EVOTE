locals {
  name = "evote-${var.environment}"
}

module "network" {
  source = "../../modules/network"

  name               = local.name
  cidr_block         = var.vpc_cidr_block
  enable_nat_gateway = var.enable_nat_gateway
}

module "database" {
  source = "../../modules/database"

  name                       = local.name
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_security_group_ids = [module.network.workloads_security_group_id]

  min_acu = var.database_min_acu
  max_acu = var.database_max_acu

  # Dev is disposable; staging/production must flip both of these.
  deletion_protection = false
  skip_final_snapshot = true
}

module "cache" {
  source = "../../modules/cache"

  name                       = local.name
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_security_group_ids = [module.network.workloads_security_group_id]

  node_type = var.cache_node_type

  # Dev is disposable: let a destroy/apply cycle reuse the secret name.
  secret_recovery_window_days = 0
}
