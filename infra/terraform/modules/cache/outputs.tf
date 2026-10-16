output "primary_endpoint" {
  description = "Primary endpoint address of the replication group."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "port" {
  description = "Port the cache listens on."
  value       = aws_elasticache_replication_group.this.port
}

output "auth_token_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the AUTH token."
  value       = aws_secretsmanager_secret.auth_token.arn
}

output "security_group_id" {
  description = "Security group attached to the cache."
  value       = aws_security_group.this.id
}
