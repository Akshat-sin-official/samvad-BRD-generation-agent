import traceback
import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.orchestrator import orchestrate_brd_generation
from ..utils.auth import CurrentUserDep

router = APIRouter()


@router.get("/demo-context")
def get_demo_context():
    """Return sample email context data for demo and testing purposes."""
    from ..services.dataset_loader import load_email_sample
    context_data = load_email_sample()
    return {"context_data": context_data or ""}


class GenerateRequest(BaseModel):
    idea: str


class GenerateMetadata(BaseModel):
    confidence_score: float
    tokens_used: int
    models_consulted: list[str]
    processing_time_ms: int
    primary_model: str


class GenerateResponse(BaseModel):
    project_id: str
    artifacts: dict
    metadata: Optional[GenerateMetadata] = None


@router.post("/generate")
async def generate_brd_endpoint(request: GenerateRequest, current_user=CurrentUserDep):
    """Generate a full BRD artifact set for the given idea. Requires authentication."""
    if not request.idea or not request.idea.strip():
        raise HTTPException(status_code=400, detail="Idea cannot be empty.")

    try:
        result = orchestrate_brd_generation(request.idea, user_id=current_user.user_id)

        # Save project to Firestore
        from ..services.firestore_client import create_project
        project_id = create_project(
            owner_id=current_user.user_id,
            title=None,  # will be auto-named "Untitled project"
            description=None,
            idea=request.idea,
            artifacts={
                "brd": result["brd"],
                "gaps": result["gaps"],
                "data_model": result["data_model"],
                "compliance": result["compliance"],
                "architecture": result["architecture"],
            },
            metadata=result["metadata"],
        )

        return {
            "project_id": project_id,
            "artifacts": {
                "brd": result["brd"],
                "gaps": result["gaps"],
                "data_model": result["data_model"],
                "compliance": result["compliance"],
                "architecture": result["architecture"],
                "metadata": result["metadata"],
            },
            "metadata": result["metadata"],
        }

    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"❌ Generation failed: {e}\n{error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed: {str(e)}",
        )
