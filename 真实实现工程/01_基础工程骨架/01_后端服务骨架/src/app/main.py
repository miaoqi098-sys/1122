from fastapi import FastAPI
from pydantic import BaseModel


SERVICE_NAME = "amazon-intelligent-operations-runtime"
SERVICE_VERSION = "0.1.0"
IMPLEMENTATION_STAGE = "P1-01"


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    stage: str
    write_capability: bool


class VersionResponse(BaseModel):
    service: str
    version: str
    stage: str
    contract_level: str


def create_app() -> FastAPI:
    app = FastAPI(
        title="Amazon Intelligent Operations Runtime",
        version=SERVICE_VERSION,
    )

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            service=SERVICE_NAME,
            version=SERVICE_VERSION,
            stage=IMPLEMENTATION_STAGE,
            write_capability=False,
        )

    @app.get("/version", response_model=VersionResponse)
    def version() -> VersionResponse:
        return VersionResponse(
            service=SERVICE_NAME,
            version=SERVICE_VERSION,
            stage=IMPLEMENTATION_STAGE,
            contract_level="STATIC_CONTRACT_VERIFIED",
        )

    return app


app = create_app()
