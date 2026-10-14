# Connection URLs deliberately exclude credentials. Fetch the password / token from the Secrets
# Manager ARNs below and inject it at runtime (never commit it, never print it in CI logs).
#
# The database and cache outputs are null while enable_database / enable_cache are false.

output "database_url" {
  description = "PostgreSQL URL without the password (password lives in database_master_secret_arn)."
  value = var.enable_database ? format(
    "postgres://%s@%s:%d/%s",
    module.database[0].master_username,
    module.database[0].endpoint,
    module.database[0].port,
    module.database[0].database_name,
  ) : null
}

output "database_reader_endpoint" {
  description = "Reader endpoint host for read-heavy queries (reports)."
  value       = var.enable_database ? module.database[0].reader_endpoint : null
}

output "database_master_secret_arn" {
  description = "Secrets Manager ARN holding the Aurora master credentials."
  value       = var.enable_database ? module.database[0].master_user_secret_arn : null
}

output "redis_url" {
  description = "Redis URL without the AUTH token (TLS is required, hence rediss://)."
  value       = var.enable_cache ? format("rediss://%s:%d", module.cache[0].primary_endpoint, module.cache[0].port) : null
}

output "redis_auth_token_secret_arn" {
  description = "Secrets Manager ARN holding the Redis AUTH token."
  value       = var.enable_cache ? module.cache[0].auth_token_secret_arn : null
}

output "vpc_id" {
  description = "ID of the VPC."
  value       = module.network.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (for the compute layer)."
  value       = module.network.private_subnet_ids
}

output "workloads_security_group_id" {
  description = "Security group that grants access to Postgres and Redis."
  value       = module.network.workloads_security_group_id
}
