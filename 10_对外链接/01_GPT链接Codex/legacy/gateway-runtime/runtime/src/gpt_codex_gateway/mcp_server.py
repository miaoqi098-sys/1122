from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

try:
    from mcp.server.mcpserver import MCPServer
except ImportError:  # compatibility with older MCP Python SDK releases
    from mcp.server.fastmcp import FastMCP as MCPServer

from .config import GatewaySettings
from .gateway import GatewayService


def build_app(settings: GatewaySettings) -> Starlette:
    service = GatewayService(settings)
    mcp = MCPServer("Amazon Agent Codex Executor")

    @mcp.tool()
    async def codex_status() -> dict[str, Any]:
        """Return Gateway/Codex availability without starting a task."""
        return (await service.status()).model_dump(mode="json")

    @mcp.tool()
    async def codex_list_projects() -> list[dict[str, str]]:
        """List the project roots that this Gateway is authorized to operate on."""
        return service.list_projects()

    @mcp.tool()
    async def codex_start_task(
        project_id: str, conversation_id: str, instruction: str, title: str = ""
    ) -> dict[str, Any]:
        """Start a real Codex task and return immediately with a durable task id."""
        task = await service.start_task(
            project_id=project_id,
            conversation_id=conversation_id,
            instruction=instruction,
            title=title or None,
        )
        return task.model_dump(mode="json")

    @mcp.tool()
    async def codex_continue_task(task_id: str, instruction: str) -> dict[str, Any]:
        """Continue the same GPT conversation/Codex thread with another turn."""
        return (await service.continue_task(task_id, instruction)).model_dump(mode="json")

    @mcp.tool()
    async def codex_get_task(task_id: str) -> dict[str, Any]:
        """Read the latest durable state of a Codex task."""
        return service.get_task(task_id).model_dump(mode="json")

    @mcp.tool()
    async def codex_read_result(task_id: str) -> dict[str, Any]:
        """Read the bounded final result currently stored for a Codex task."""
        record = service.get_task(task_id)
        return {
            "task_id": record.task_id,
            "status": record.status.value,
            "result": record.result,
            "error": record.error,
            "updated_at": record.updated_at,
        }

    @mcp.tool()
    async def codex_cancel_task(task_id: str) -> dict[str, Any]:
        """Interrupt the exact in-flight Codex turn for a task."""
        return (await service.cancel_task(task_id)).model_dump(mode="json")

    @mcp.tool()
    async def codex_run_command(
        project_id: str, conversation_id: str, command: str, purpose: str = ""
    ) -> dict[str, Any]:
        """Ask Codex to run and verify a command inside an authorized project root."""
        return (
            await service.run_command(
                project_id=project_id,
                conversation_id=conversation_id,
                command=command,
                purpose=purpose,
            )
        ).model_dump(mode="json")

    @mcp.tool()
    async def codex_apply_changes(project_id: str, conversation_id: str, instruction: str) -> dict[str, Any]:
        """Ask Codex to make, test and verify real project changes."""
        return (
            await service.apply_changes(
                project_id=project_id,
                conversation_id=conversation_id,
                instruction=instruction,
            )
        ).model_dump(mode="json")

    @mcp.tool()
    async def codex_use_secret(
        project_id: str, conversation_id: str, secret_ref: str, instruction: str
    ) -> dict[str, Any]:
        """Use a locally protected environment secret by reference; plaintext is never returned to GPT."""
        return (
            await service.use_secret(
                project_id=project_id,
                conversation_id=conversation_id,
                secret_ref=secret_ref,
                instruction=instruction,
            )
        ).model_dump(mode="json")

    async def health(_request: Request) -> JSONResponse:
        status = await service.status()
        return JSONResponse(status.model_dump(mode="json"))

    # MCP endpoint lives at /mcp/ after the Starlette mount.
    mcp_app = mcp.streamable_http_app(
        streamable_http_path="/",
        stateless_http=True,
        json_response=True,
    )

    @contextlib.asynccontextmanager
    async def lifespan(_app: Starlette) -> AsyncIterator[None]:
        async with mcp.session_manager.run():
            try:
                yield
            finally:
                await service.close()

    return Starlette(
        routes=[
            Route("/health", health, methods=["GET"]),
            Mount("/mcp", app=mcp_app),
        ],
        lifespan=lifespan,
    )
