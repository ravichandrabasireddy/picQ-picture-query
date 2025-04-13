from fastapi import APIRouter, Path, Body, HTTPException
from typing import Optional
from pydantic import BaseModel, Field
import uuid
from sse_starlette.sse import EventSourceResponse
from fastapi.responses import StreamingResponse
import json
from ..query_engine.search import search_stream
from ...core.logging_config import setup_logging
from ..query_engine.image_query import chat_message_stream

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

@router.post("/search", response_model=None, tags=["search"])
async def search_endpoint(request: SearchRequest):
    """
    Execute a search query with optional image and stream the results as Server-Sent Events.
    Each step of the search process will be sent as a separate event.
    """
    try:
        logger.info(f"Starting search with ID: {request.id} for query: {request.query}")
        
        async def event_generator():
            try:
                async for chunk in search_stream(
                    search_id=request.id,
                    query=request.query,
                    image_url=request.image
                ):
                    yield chunk
            except Exception as e:
                logger.error(f"Streaming search error: {str(e)}")
                yield {"event": "error", "data": f"{{\"message\": \"Search failed: {str(e)}\"}}"}
        
        return EventSourceResponse(event_generator())
        
    except Exception as e:
        logger.error(f"Error setting up search stream: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")



@router.post("/chat/{match_id}" , tags=["search"])
async def chat_with_photo(
    match_id: str = Path(..., description="The ID of the match to chat about"),
    question: str = Body(..., embed=True, description="The user's question about the photo")
):
    """
    Send a question about a photo match and get a streaming response
    
    Args:
        match_id: ID of the match to chat about
        question: The user's question
        
    Returns:
        StreamingResponse: Server-sent events with response chunks
    """
    async def event_generator():
        async for event in chat_message_stream(match_id, question):
            if event:
                yield f"data: {json.dumps(event)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )