from __future__ import annotations

import argparse
import os

import uvicorn

from .config import GatewaySettings
from .mcp_server import build_app


def main() -> None:
    parser = argparse.ArgumentParser(description="Persistent GPT-Codex local MCP Gateway")
    parser.add_argument(
        "--config",
        default=os.environ.get("GPT_CODEX_GATEWAY_CONFIG", "config.local.json"),
        help="Path to Gateway JSON configuration",
    )
    parser.add_argument("--log-level", default="info")
    args = parser.parse_args()
    settings = GatewaySettings.load(args.config)
    app = build_app(settings)
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level=args.log_level,
        access_log=False,
    )


if __name__ == "__main__":
    main()
