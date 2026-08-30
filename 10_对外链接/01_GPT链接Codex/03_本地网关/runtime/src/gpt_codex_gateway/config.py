from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class ProjectConfig(BaseModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9._-]+$")
    root: Path

    @field_validator("root", mode="before")
    @classmethod
    def expand_root(cls, value: object) -> Path:
        return Path(os.path.expandvars(os.path.expanduser(str(value)))).resolve()


class GatewaySettings(BaseModel):
    host: str = "127.0.0.1"
    port: int = Field(default=8765, ge=1024, le=65535)
    data_dir: Path = Path("~/.amazon-agent/gpt-codex-gateway")
    codex_command: list[str] = Field(default_factory=lambda: ["codex", "app-server"])
    approval_policy: Literal["untrusted", "on-failure", "on-request", "never"] = "never"
    sandbox: Literal["read-only", "workspace-write", "danger-full-access"] = "danger-full-access"
    turn_timeout_seconds: int = Field(default=3600, ge=30, le=86400)
    projects: list[ProjectConfig]

    @field_validator("data_dir", mode="before")
    @classmethod
    def expand_data_dir(cls, value: object) -> Path:
        return Path(os.path.expandvars(os.path.expanduser(str(value)))).resolve()

    @model_validator(mode="after")
    def validate_unique_projects(self) -> "GatewaySettings":
        ids = [p.id for p in self.projects]
        if len(ids) != len(set(ids)):
            raise ValueError("project ids must be unique")
        if not self.codex_command:
            raise ValueError("codex_command must not be empty")
        return self

    def project(self, project_id: str) -> ProjectConfig:
        for project in self.projects:
            if project.id == project_id:
                return project
        raise KeyError(f"Unknown project_id: {project_id}")

    @classmethod
    def load(cls, path: str | Path) -> "GatewaySettings":
        config_path = Path(path).expanduser().resolve()
        payload = json.loads(config_path.read_text(encoding="utf-8"))
        settings = cls.model_validate(payload)
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        return settings
