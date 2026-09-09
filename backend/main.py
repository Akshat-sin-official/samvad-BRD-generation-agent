from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import generate
from .routes import projects, users
from .services.vertex_client import init_vertex

app = FastAPI(title="Autonomous BRD-to-Data Intelligence Agent")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Vertex AI
@app.on_event("startup")
async def startup_event():
    try:
        init_vertex()
    except Exception as e:
        print(f"⚠️ Vertex AI startup initialization skipped or failed: {e}")

# Include routes
app.include_router(generate.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"message": "Autonomous BRD Agent API is running"}
