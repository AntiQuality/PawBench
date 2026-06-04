# -*- coding: utf-8 -*-
"""Shared constants for all pawbench agent implementations."""

# Standard workspace path inside every benchmark container.
AGENT_WORKSPACE = "/app/working/workspaces/default"

# Default Docker images for each agent type.
# Build instructions are in the comments next to each constant.
QWENPAW_DEFAULT_IMAGE  = "qwenclawbench-qwenpaw:latest"   # docker/Dockerfile.pawbench-qwenpaw
OPENCLAW_DEFAULT_IMAGE = "openclaw-pawbench:latest"       # examples/upstream/docker/Dockerfile.pawbench-openclaw
HERMES_DEFAULT_IMAGE   = "hermes-qwenclawbench:latest"    # docker/Dockerfile.hermes
