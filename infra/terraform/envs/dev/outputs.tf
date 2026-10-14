# Connection URLs deliberately exclude credentials. Fetch the password / token from the Secrets
# Manager ARNs below and inject it at runtime (never commit it, never print it in CI logs).

output "database_url" {
  description = "PostgreSQL URL without the password (password lives in database_master_secret_arn)."
  value = format(
    "postgres://%s@%s:%d/%s",
    module.database.master_username,
    module.database.endpoint,
    module.database.port,
    module.database.database_name,
  )
}

output "database_reader_endpoint" {
  description = "Reader endpoint host for read-heavy queries (reports)."
  value       = module.database.reader_endpoint
}

output "database_master_secret_arn" {
  description = "Secrets Manager ARN holding the Aurora master credentials."
  value       = module.database.master_user_secret_arn
}

output "redis_url" {
  description = "Redis URL without the AUTH token (TLS is required, hence rediss://)."
  value       = format("rediss://%s:%d", module.cache.primary_endpoint, module.cache.port)
}

output "redis_auth_token_secret_arn" {
  description = "Secrets Manager ARN holding the Redis AUTH token."
  value       = module.cache.auth_token_secret_arn
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
