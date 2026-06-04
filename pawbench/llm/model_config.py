"""Model configuration manager for pawbench - supporting multiple providers like Harbor."""

import os
from typing import Dict, Optional, Any
from dataclasses import dataclass
from enum import Enum


class ProviderType(Enum):
    """Supported LLM providers."""
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GOOGLE = "google"
    AZURE = "azure"
    DASHSCOPE = "dashscope"
    CUSTOM = "custom"


@dataclass
class ModelConfig:
    """Configuration for a specific model."""
    provider: ProviderType
    model_name: str
    api_key: str
    base_url: str
    api_version: Optional[str] = None  # For Azure
    extra_config: Optional[Dict[str, Any]] = None
    # Capability flags (used by agent impl to configure model metadata)
    supports_vision: bool = False
    reasoning: bool = False
    context_window: Optional[int] = None
    max_tokens: Optional[int] = None
    # Optional companion vision model (for text-only models that need a separate VL model)
    vision_model: str = ""

    def get_full_model_identifier(self) -> str:
        """Get the full model identifier in provider/model format."""
        return f"{self.provider.value}/{self.model_name}"


class ModelConfigManager:
    """Manages model configurations for different providers."""

    PROVIDER_DEFAULT_URLS = {
        ProviderType.ANTHROPIC: "https://api.anthropic.com",
        ProviderType.OPENAI: "https://api.openai.com/v1",
        ProviderType.GOOGLE: "https://generativelanguage.googleapis.com",
        ProviderType.AZURE: "",  # Azure needs specific endpoint
        # Default to CN DashScope endpoint; override with DASHSCOPE_BASE_URL or set
        # DASHSCOPE_INTL=1 to use the international endpoint.
        ProviderType.DASHSCOPE: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        ProviderType.CUSTOM: "https://api.openai.com/v1",  # Default to OpenAI-compatible
    }

    @classmethod
    def parse_model_identifier(cls, model_identifier: str) -> ModelConfig:
        """Parse a model identifier in the format 'provider/model' or just 'model'.

        Args:
            model_identifier: String like 'anthropic/claude-3-5-sonnet' or 'gpt-4o'

        Returns:
            ModelConfig with appropriate provider and settings
        """
        aliases = cls.get_available_models()
        if model_identifier.strip() in aliases:
            model_identifier = aliases[model_identifier.strip()]

        if '/' in model_identifier:
            provider_str, model_name = model_identifier.split('/', 1)
            try:
                provider = ProviderType(provider_str.lower())
            except ValueError:
                # Unknown provider, treat as custom
                provider = ProviderType.CUSTOM
        else:
            # No provider specified — infer from environment base_url first,
            # then fall back to OPENAI so qwenpaw doesn't hit api.openai.com
            # when running on clusters that can only reach DashScope.
            env_base_url = (
                os.getenv("OPENAI_BASE_URL", "")
                or os.getenv("MODEL_BASE_URL", "")
            ).lower()
            if "dashscope.aliyuncs.com" in env_base_url:
                provider = ProviderType.DASHSCOPE
            else:
                provider = ProviderType.OPENAI
            model_name = model_identifier

        # Get API key from environment or config
        api_key = cls._get_api_key_for_provider(provider)

        # Get base URL
        base_url = cls._get_base_url_for_provider(provider, model_identifier)

        # Special handling for Azure (needs API version)
        api_version = None
        if provider == ProviderType.AZURE:
            api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2023-05-15")

        # Pawbench default: every model under evaluation is treated as multimodal.
        # Image/vision paths use the same model id (see openclaw_agent imageModel).
        # Opt out only when agent_config sets a separate vision_model companion.
        supports_vision = True
        reasoning_keywords = ("o1", "o3", "thinking", "reasoning", "r1", "r2", "a3b")
        reasoning = any(kw in model_name.lower() for kw in reasoning_keywords)

        return ModelConfig(
            provider=provider,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
            api_version=api_version,
            supports_vision=supports_vision,
            reasoning=reasoning,
        )

    @classmethod
    def _get_api_key_for_provider(cls, provider: ProviderType) -> str:
        """Get the appropriate API key from environment variables for the provider."""
        env_var_map = {
            ProviderType.ANTHROPIC: "ANTHROPIC_API_KEY",
            ProviderType.OPENAI: "OPENAI_API_KEY",
            ProviderType.GOOGLE: "GOOGLE_API_KEY",
            ProviderType.AZURE: "AZURE_OPENAI_API_KEY",
            ProviderType.DASHSCOPE: "DASHSCOPE_API_KEY",
            ProviderType.CUSTOM: "OPENAI_API_KEY",  # Default to OpenAI key
        }

        env_var = env_var_map[provider]
        api_key = os.getenv(env_var)

        if not api_key:
            # Fallback to a common variable if specific one isn't set
            if provider == ProviderType.ANTHROPIC:
                api_key = os.getenv("OPENAI_API_KEY", "")
            elif provider == ProviderType.GOOGLE:
                api_key = os.getenv("GOOGLE_GEMINI_API_KEY", os.getenv("GOOGLE_AI_STUDIO_API_KEY", ""))
            elif provider == ProviderType.DASHSCOPE:
                api_key = os.getenv("ALIYUN_API_KEY", "")
            elif provider == ProviderType.CUSTOM:
                api_key = os.getenv("OPENAI_API_KEY", os.getenv("CUSTOM_API_KEY", ""))

        return api_key or os.getenv("OPENAI_API_KEY", "")  # Final fallback

    @classmethod
    def _get_base_url_for_provider(cls, provider: ProviderType, full_identifier: str) -> str:
        """Get the appropriate base URL for the provider."""
        if provider == ProviderType.CUSTOM:
            if full_identifier.startswith(('http://', 'https://')):
                return full_identifier
            custom_base_url = os.getenv("CUSTOM_BASE_URL")
            if custom_base_url:
                return custom_base_url

        if provider == ProviderType.DASHSCOPE:
            # Allow override for China mainland or other regions
            dashscope_base_url = os.getenv("DASHSCOPE_BASE_URL")
            if dashscope_base_url:
                return dashscope_base_url

        # Check if it's an Azure deployment (format: azure/deployment-name@resource-name)
        if provider == ProviderType.AZURE and '@' in full_identifier:
            deployment_name, resource_name = full_identifier.split('@', 1)
            # Extract deployment name from provider/model format
            parts = deployment_name.split('/')
            if len(parts) > 1:
                deployment = parts[1]
                resource = resource_name
                return f"https://{resource}.openai.azure.com"

        return cls.PROVIDER_DEFAULT_URLS.get(provider, "https://api.openai.com/v1")

    @classmethod
    def validate_model_config(cls, config: ModelConfig) -> bool:
        """Validate that the model configuration is complete and valid."""
        if not config.api_key:
            print(f"Warning: No API key found for {config.provider.value} provider")
            return False

        if not config.base_url:
            print(f"Warning: No base URL found for {config.provider.value} provider")
            return False

        # For Azure, also need API version
        if config.provider == ProviderType.AZURE and not config.api_version:
            print("Warning: No API version found for Azure provider")
            return False

        return True

    @classmethod
    def get_available_models(cls) -> Dict[str, str]:
        """Get a mapping of common model names to their provider-specific names."""
        return {
            # Anthropic — current generation (see https://docs.anthropic.com/en/docs/about-claude/models)
            "claude-sonnet": "anthropic/claude-sonnet-4-6",
            "claude-opus": "anthropic/claude-opus-4-7",
            "claude-haiku": "anthropic/claude-haiku-4-5",
            # Anthropic — Claude 3.x (pinned snapshots)
            "claude-3-5-sonnet": "anthropic/claude-3-5-sonnet-20241022",
            "claude-3-opus": "anthropic/claude-3-opus-20240229",
            "claude-3-haiku": "anthropic/claude-3-haiku-20240307",

            # OpenAI — frontier (see https://platform.openai.com/docs/models)
            "gpt-5.4": "openai/gpt-5.4",
            "gpt-5.4-mini": "openai/gpt-5.4-mini",
            "gpt-5.4-nano": "openai/gpt-5.4-nano",
            # OpenAI — prior generations (still common in benchmarks)
            "gpt-4o": "openai/gpt-4o-2024-08-06",
            "gpt-4o-mini": "openai/gpt-4o-mini",
            "gpt-4-turbo": "openai/gpt-4-turbo",
            "gpt-4": "openai/gpt-4",
            "gpt-3.5-turbo": "openai/gpt-3.5-turbo",

            # Google — Gemini (see https://ai.google.dev/gemini-api/docs/models)
            "gemini-pro": "google/gemini-3.1-pro-preview",
            "gemini-3.1-pro": "google/gemini-3.1-pro-preview",
            "gemini-1.5-pro": "google/gemini-1.5-pro",
            "gemini-1.5-flash": "google/gemini-1.5-flash",

            # DashScope / Qwen (see https://www.alibabacloud.com/help/en/model-studio)
            # Latest: qwen3.6-plus (April 2026)
            "qwen": "dashscope/qwen3.6-plus",
            "qwen3.6-plus": "dashscope/qwen3.6-plus",
            "qwen3.5-plus": "dashscope/qwen3.5-plus",
            "qwen3-max": "dashscope/qwen3-max",
            "qwen3-plus": "dashscope/qwen3-plus",
            "qwen3-turbo": "dashscope/qwen3-turbo",

            # Custom OpenAI-compatible proxy (CUSTOM_BASE_URL / CUSTOM_API_KEY)
            "opus-4.6": "custom/openai.claude-opus-4-6",
            "claude-opus-4.6": "custom/openai.claude-opus-4-6",
        }


def get_model_config(model_identifier: str) -> ModelConfig:
    """Convenience function to get model configuration from identifier."""
    return ModelConfigManager.parse_model_identifier(model_identifier)


def get_available_providers() -> Dict[str, str]:
    """Get human-readable list of available providers."""
    return {
        "Anthropic": "anthropic/claude-sonnet-4-6",
        "OpenAI": "openai/gpt-5.4",
        "Google": "google/gemini-3.1-pro-preview",
        "DashScope (Qwen)": "dashscope/qwen3.6-plus",
        "Custom (OpenAI-compatible)": "custom/my-model-name",
        "Azure OpenAI": "azure/deployment-name@resource-name",
    }