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

  # Partial configuration: bucket/key/region are supplied at init time so no account details are
  # committed. See infra/terraform/README.md ("Remote state").
  backend "s3" {
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "evote"
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "hannah248olives/EVOTE"
    }
  }
}
