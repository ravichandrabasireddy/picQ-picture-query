from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel, Field
import uuid

from ..query_engine.search import search
from ...core.logging_config import setup_logging

router = APIRouter()
logger = setup_logging()

class SearchRequest(BaseModel):
    id: str = Field(..., description="Unique identifier for this search")
    query: str = Field(..., description="The search query text")
    image: Optional[str] = Field(None, description="Optional URL to an image to include in search")

class SearchResponse(BaseModel):
    search_id: str
    query: str
    extracted_details: str
    formatted_query: str
    formatting_explanation: Optional[str] = None
    matches: list

@router.post("/search", response_model=SearchResponse, tags=["search"])
async def search_endpoint(request: SearchRequest):
    """
    Execute a search query with optional image.
    """
    try:
        logger.info(f"Starting search with ID: {request.id} for query: {request.query}")
        
        # Call the search function with the search parameters
        result = await search(
            search_id=request.id,
            query=request.query,
            image_url=request.image
        )
        
        logger.info(f"Search {request.id} completed with {len(result.get('matches', []))} matches")
        return result
        
    except Exception as e:
        logger.error(f"Error processing search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")