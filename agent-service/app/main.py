from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.chat import router as chat_router
from app.config import get_settings

settings = get_settings()
app = FastAPI(title="Knowledge Agent API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.include_router(chat_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "knowledge-agent",
        "rag_backend": settings.rag_backend,
    }


frontend_root = Path(__file__).resolve().parents[2]


@app.get("/", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
def frontend_index():
    return FileResponse(frontend_root / "index.html")


@app.get("/styles.css", include_in_schema=False)
def frontend_styles():
    return FileResponse(frontend_root / "styles.css", media_type="text/css")


@app.get("/scripts.js", include_in_schema=False)
def frontend_scripts():
    return FileResponse(frontend_root / "scripts.js", media_type="text/javascript")


app.mount(
    "/Figure",
    StaticFiles(directory=frontend_root / "Figure"),
    name="figures",
)
