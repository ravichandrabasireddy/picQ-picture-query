from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends, Path, Query
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

from ...core.database import get_supabase_client
from ...core.logging_config import setup_logging
from ...core.config import get_settings
from ..photo_engine.get_photo_url import upload_image_to_storage
from ..photo_engine.ingest_photo import store_photo_in_db

# Initialize settings and logger
settings = get_settings()
logger = setup_logging()

# Update router with tags
router = APIRouter(tags=["database"], prefix="/db")

class SearchResponse(BaseModel):
    search_id: str
    query_text: str
    query_image_url: Optional[str] = None
    photo_id: Optional[str] = None
    success: bool = True

# Update the MatchResponse model to include additional photo details
class MatchResponse(BaseModel):
    id: str
    photo_id: str
    photo_url: Optional[str]
    formatted_address: Optional[str]
    taken_at: Optional[str]
    photo_analysis: Optional[str]
    is_best_match: bool
    reason_for_match: Optional[str]
    interesting_details: Optional[List[str]]
    rank: int
    heading: Optional[str]

class SearchResultResponse(BaseModel):
    search_id: str
    search_result_id: Optional[str]
    query_text: str
    query_image_url: Optional[str]
    has_results: bool
    matches: List[MatchResponse] = []

# Add Pydantic models for chat responses
class ChatMessageResponse(BaseModel):
    id: str
    is_user: bool
    message_text: str
    created_at: str

class ChatResponse(BaseModel):
    chat_id: str
    match_id: str
    messages: List[ChatMessageResponse] = []

@router.post("/insert/searches", response_model=SearchResponse)
async def create_search(
    query_text: str = Form(...),
    query_image: Optional[UploadFile] = File(None)
) -> Dict[str, Any]:
    """
    Create a new search record with optional image upload
    
    Args:
        query_text: The text query for the search
        query_image: Optional image file for visual search
        
    Returns:
        dict: Search record details including IDs
    """
    try:
        # Initialize variables
        query_image_url = None
        photo_id = None
        
        # Handle image upload if provided
        if query_image:
            # Upload image to storage
            upload_result = await upload_image_to_storage(query_image)
            query_image_url = upload_result["url"]
            metadata = upload_result["metadata"]
            
            # Store photo in photos table
            photo_id = await store_photo_in_db(
                photo_url=query_image_url,
                metadata=metadata
            )
            logger.info(f"Stored query image as photo with ID: {photo_id}")
        
        # Get Supabase client
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
        # Create search record
        search_data = {
            "query_text": query_text,
            "query_image_url": query_image_url
        }
        
        result = supabase.table('searches').insert(search_data).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to create search record")
            
        search_id = result.data[0]['id']
        logger.info(f"Created search record with ID: {search_id}")
            
        # Return the search details
        return {
            "search_id": search_id,
            "query_text": query_text,
            "query_image_url": query_image_url,
            "photo_id": photo_id,
            "success": True
        }
        
    except Exception as e:
        logger.error(f"Error creating search record: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create search: {str(e)}")

@router.get("/search_results/{search_id}", response_model=SearchResultResponse)
async def get_search_results(
    search_id: str = Path(..., description="The UUID of the search")
) -> Dict[str, Any]:
    """
    Get search results for a given search ID
    
    This endpoint checks if results already exist for the search,
    and returns them if available. Otherwise, it indicates that
    no results are available yet.
    
    Args:
        search_id: The UUID of the search to get results for
        
    Returns:
        dict: Search results including matches if available with detailed photo information
    """
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
        # First, get the search record
        search_response = supabase.table('searches').select('*').eq('id', search_id).execute()
        
        if not search_response.data or len(search_response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Search with ID {search_id} not found")
        
        search = search_response.data[0]
        
        # Check if this search has results
        results_response = supabase.table('search_results') \
            .select('id') \
            .eq('search_id', search_id) \
            .execute()
            
        has_results = bool(results_response.data and len(results_response.data) > 0)
        search_result_id = results_response.data[0]['id'] if has_results else None
        
        # Initialize response
        response = {
            "search_id": search_id,
            "search_result_id": search_result_id,
            "query_text": search['query_text'],
            "query_image_url": search['query_image_url'],
            "has_results": has_results,
            
            "matches": []
        }
        
        # If we have results, get the matches with detailed photo information
        if has_results:
            # Modify the select to include more fields from the photos table
            matches_response = supabase.from_('matches') \
                .select('''
                    *,
                    photos (
                        id,
                        photo_url,
                        latitude,
                        longitude,
                        taken_at,
                        photo_analysis,
                        formatted_address
                    )
                ''') \
                .eq('search_result_id', search_result_id) \
                .order('rank') \
                .execute()
            
            if matches_response.data and len(matches_response.data) > 0:
                for match in matches_response.data:
                    # Get photo data or set defaults
                    photo_data = match.get('photos', {})
                    
                    # Format address from latitude/longitude if available
    
                        # Note: In a real app, you might want to use a geocoding service 
                        # to convert coordinates to actual addresses

                    response["matches"].append({
                        "id": match['id'],
                        "photo_id": match['photo_id'],
                        "photo_url": photo_data.get('photo_url') if photo_data else None,
                        "formatted_address": photo_data.get('formatted_address'),
                        "taken_at": photo_data.get('taken_at'),
                        "photo_analysis": photo_data.get('photo_analysis'),
                        "is_best_match": match['is_best_match'],
                        "reason_for_match": match['reason_for_match'],
                        "interesting_details": match['interesting_details'].split("\n") if isinstance(match['interesting_details'], str) else match['interesting_details'],
                        "rank": match['rank'],
                        "heading":match['heading'],
                    })
        
        return response
        
    except Exception as e:
        logger.error(f"Error fetching search results: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch search results: {str(e)}")

@router.get("/chats/match/{match_id}", response_model=ChatResponse)
async def get_chats_by_match_id(
    match_id: str = Path(..., description="The UUID of the match"),
    limit: int = Query(50, description="Maximum number of messages to return")
) -> Dict[str, Any]:
    """
    Get chat messages for a specific match, ordered by creation time.
    
    This endpoint retrieves all chat messages associated with a match,
    creating a new user_chat if one doesn't exist yet.
    
    Args:
        match_id: The UUID of the match
        limit: Maximum number of messages to return (default: 50)
        
    Returns:
        dict: Chat details including all messages
    """
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
        # First check if the match exists
        match_response = supabase.table('matches').select('id').eq('id', match_id).execute()
        
        if not match_response.data or len(match_response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Match with ID {match_id} not found")
        
        # Check if a user_chat exists for this match, create one if not
        user_chat_response = supabase.table('user_chats').select('id').eq('match_id', match_id).execute()
        
        if not user_chat_response.data or len(user_chat_response.data) == 0:
            # Create a new user_chat
            logger.info(f"Creating new user_chat for match {match_id}")
            chat_data = {"match_id": match_id}
            user_chat_response = supabase.table('user_chats').insert(chat_data).execute()
            
            if not user_chat_response.data or len(user_chat_response.data) == 0:
                raise HTTPException(status_code=500, detail="Failed to create user chat")
        
        chat_id = user_chat_response.data[0]['id']
        
        # Get messages for this chat, ordered by creation time (ascending)
        messages_response = supabase.table('chat_messages') \
            .select('id, is_user, message_text, created_at') \
            .eq('user_chat_id', chat_id) \
            .order('created_at', desc=False) \
            .limit(limit) \
            .execute()
        
        # Format response
        chat_messages = messages_response.data if messages_response.data else []
        
        # Format the response with ISO format dates
        formatted_messages = []
        for message in chat_messages:
            # Convert created_at to string if it's not already
            created_at = message.get('created_at')
            if created_at is not None and not isinstance(created_at, str):
                created_at = created_at.isoformat() if hasattr(created_at, 'isoformat') else str(created_at)
            else:
                created_at = message.get('created_at')
                
            formatted_messages.append({
                "id": message.get('id'),
                "is_user": message.get('is_user'),
                "message_text": message.get('message_text'),
                "created_at": created_at
            })
        
        return {
            "chat_id": chat_id,
            "match_id": match_id,
            "messages": formatted_messages
        }
        
    except Exception as e:
        logger.error(f"Error fetching chat messages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch chat messages: {str(e)}")