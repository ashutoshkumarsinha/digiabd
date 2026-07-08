packer {
  required_plugins {
    docker = {
      version = ">= 1.1.3"
      source  = "github.com/hashicorp/docker"
    }
  }
}

variable "version" {
  type    = string
  default = "dev"
}

variable "repo_prefix" {
  type    = string
  default = "digiabd"
}

locals {
  api_repo = "${var.repo_prefix}/api"
  web_repo = "${var.repo_prefix}/web"
  tags     = ["${var.version}", "latest"]
}

source "docker" "api" {
  commit = true
  build {
    path      = "Dockerfile"
    build_dir = "apps/api"
    pull      = true
  }
}

source "docker" "web" {
  commit = true
  build {
    path      = "Dockerfile"
    build_dir = "apps/web"
    pull      = true
  }
}

build {
  name    = "digiabd-images"
  sources = ["source.docker.api", "source.docker.web"]

  post-processors {
    post-processor "docker-tag" {
      repository = local.api_repo
      tags       = local.tags
      only       = ["docker.api"]
    }

    post-processor "docker-tag" {
      repository = local.web_repo
      tags       = local.tags
      only       = ["docker.web"]
    }
  }
}

