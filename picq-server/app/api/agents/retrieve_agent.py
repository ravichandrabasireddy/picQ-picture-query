from ...core.utils import generate_embeddings
from ...core.database import get_supabase_client
from ...core.logging_config import setup_logging
from ...core.config import get_settings
from typing import List, Dict, Any
from fastapi import HTTPException

# Initialize settings and logger
settings = get_settings()
logger = setup_logging()

async def perform_similarity_search(
    query: str, 
    match_threshold: float = 0.7, 
    match_count: int = 4, 
    client=None
) -> List[Dict[str, Any]]:
    """
    Perform a similarity search using vector embeddings
    
    Args:
        query: The search query text
        match_threshold: Minimum similarity threshold (0 to 1)
        match_count: Maximum number of results to return
        client: Optional existing Google Generative AI client
        
    Returns:
        List of matching photos with similarity scores
    """
    try:
        # 1. Generate embeddings for the query
        logger.info(f"Generating embeddings for query: {query}")
        query_embedding = await generate_embeddings(query, client)
        
        # 2. Get Supabase client
        supabase = get_supabase_client()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase client not initialized")
        
        # 3. Call the match_photos RPC function
        logger.info(f"Performing similarity search with threshold {match_threshold}, limit {match_count}")
        response = (
            supabase.rpc(
                "match_photos", 
                {
                    "query_embedding": query_embedding, 
                    "match_threshold": match_threshold, 
                    "match_count": match_count
                }
            )
            .execute()
        )
        
        # 4. Extract and process results
        if response and hasattr(response, 'data'):
            results = response.data
            logger.info(f"Found {len(results)} matching photos")
            
            # Format and return the results with rank (index + 1)
            return [
                {
                    "id": result["id"],
                    "photo_url": result["photo_url"],
                    "photo_analysis": result["photo_analysis"],
                    "similarity": result["similarity"],
                    "rank": index 
                }
                for index, result in enumerate(results)
            ]
        else:
            logger.warning("No results or unexpected response format from similarity search")
            return []
            
    except Exception as e:
        logger.error(f"Error performing similarity search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching photos: {str(e)}")