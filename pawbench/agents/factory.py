# -*- coding: utf-8 -*-
"""AgentFactory — registry mapping agent_type → (AgentClass, default_docker_image).

Adding a new agent type only requires:
1. Create a new :class:`ContainerAgent` subclass under ``impl/``.
2. Add one entry to :attr:`AgentFactory._REGISTRY` here.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any

from pawbench.agents.constants import (
    QWENPAW_DEFAULT_IMAGE,
    HERMES_DEFAULT_IMAGE,
    OPENCLAW_DEFAULT_IMAGE,
)

if TYPE_CHECKING:
    pass


class AgentFactory:
    """Registry mapping agent_type → (AgentClass, default_docker_image).

    Imports of concrete agent classes are deferred to :meth:`_populate` so
    that this module can be imported without triggering circular dependencies.
    """

    # Populated lazily to avoid import-time circular dependencies.
    _REGISTRY: "dict[str, tuple[type, str]]" = {}
    _AGENT_RUNTIME_CONFIG_KEYS = (
        "generate_kwargs",
        "max_tokens",
        "max_turns",
        "qwenpaw_version",
        "skip_bootstrap",
        "task_timeout_s",
        "thinking",
        "thinking_level",
        "vision_model",
    )

    @classmethod
    def _populate(cls) -> None:
        if cls._REGISTRY:
            return
        from pawbench.agents.impl.qwenpaw_agent import QwenPawAgent
        from pawbench.agents.impl.openclaw_agent import OpenClawAgent
        from pawbench.agents.impl.hermes_agent import HermesAgent
        cls._REGISTRY = {
            "qwenpaw":  (QwenPawAgent,   QWENPAW_DEFAULT_IMAGE),
            "openclaw": (OpenClawAgent,  OPENCLAW_DEFAULT_IMAGE),
            "hermes":   (HermesAgent,    HERMES_DEFAULT_IMAGE),
        }

    @classmethod
    def create(cls, agent_config: dict[str, Any]) -> Any:
        """Instantiate the agent class for *agent_config['agent_type']*."""
        cls._populate()
        agent_type = agent_config.get("agent_type", "qwenpaw")
        entry = cls._REGISTRY.get(agent_type)
        if entry is None:
            raise ValueError(
                f"Unknown agent_type: {agent_type!r}. "
                f"Known types: {list(cls._REGISTRY)}"
            )
        AgentCls, _ = entry
        kwargs = {
            "model": agent_config["model"],
            "api_key": agent_config.get("api_key") or os.environ.get("OPENAI_API_KEY", ""),
            "base_url": agent_config.get("base_url") or os.environ.get(
                "OPENAI_BASE_URL", "https://api.openai.com/v1"
            ),
            "api_model_name": agent_config.get("api_model_name"),
        }
        for key in cls._AGENT_RUNTIME_CONFIG_KEYS:
            if key in agent_config:
                kwargs[key] = agent_config[key]
        return AgentCls(**kwargs)

    @classmethod
    def default_image_for_type(cls, agent_type: str) -> str:
        """Return the default Docker image name for *agent_type*."""
        cls._populate()
        entry = cls._REGISTRY.get(agent_type)
        if entry is None:
            return QWENPAW_DEFAULT_IMAGE
        _, image = entry
        return image
