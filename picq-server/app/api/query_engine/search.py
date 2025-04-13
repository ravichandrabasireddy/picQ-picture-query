import json
import tempfile
import aiohttp
import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path

from google import genai

from ...core.config import get_settings
from ...core.logging_config import setup_logging
from ..agents.query_extract_agent import generate_query_extraction
from ..agents.photo_feature_extract_agent import generate_analysis
from ..agents.format_query_agent import generate_format_query
from ..agents.retrieve_agent import perform_similarity_search
from ..agents.reasoning_agent import generate_reasoning

logger = setup_logging()

async def collect_stream_content(stream):
    """Helper function to collect content from a stream which may be a generator or async generator"""
    result = ""
    
    # First, try treating it as an async generator
    try:
        async for chunk in stream:
            if hasattr(chunk, 'text'):
                result += chunk.text
        return result
    except TypeError:
        # If that fails, it might be a regular generator
        for chunk in stream:
            if hasattr(chunk, 'text'):
                result += chunk.text
        return result

async def search(search_id: str, query: str, image_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Orchestrates the search process using query and optional image analysis.
    
    Args:
        search_id: Unique identifier for this search
        query: The user's search query text
        image_url: Optional URL to an image to include in the search
        
    Returns:
        Dict containing search results with reasoning for matches
    """
    # Initialize shared client to reuse across API calls
    settings = get_settings()
    client = genai.Client(api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY)
    
    try:
        # Step 1: Extract query details
        logger.info(f"Extracting details from query: {query}")
        query_extraction_stream = await generate_query_extraction(query, client)
        extracted_details = await collect_stream_content(query_extraction_stream)
        
        # Step 2: Process image if provided
        image_analysis = None
        if image_url:
            logger.info(f"Processing image from URL: {image_url}")
            # Download image to temporary file
            temp_dir = Path(tempfile.gettempdir())
            temp_image_path = temp_dir / f"search_image_{search_id}.jpg"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(image_url) as response:
                    if response.status == 200:
                        image_content = await response.read()
                        with open(temp_image_path, 'wb') as f:
                            f.write(image_content)
                        
                        # No metadata info available, use empty strings
                        date = ""
                        location = ""
                        image_analysis_stream = await generate_analysis(
                            str(temp_image_path), date, location, client
                        )
                        image_analysis = await collect_stream_content(image_analysis_stream)
                    else:
                        logger.error(f"Failed to download image: {response.status}")
        
        # Step 3: Generate formatted query
        logger.info("Generating formatted search query")
        format_query_stream = await generate_format_query(
            query, extracted_details, image_analysis, client
        )
        formatted_query_response = await collect_stream_content(format_query_stream)
        
        # Parse the formatted query from JSON response
        try:
            formatted_query_data = json.loads(formatted_query_response)
            formatted_query = formatted_query_data["formatted_query"]
            formatting_explanation = formatted_query_data.get("explanation", "")
            logger.info(f"Formatted query: {formatted_query}")
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"Error parsing formatted query: {e}")
            formatted_query = query  # Fallback to original query
            formatting_explanation = "Error formatting query"
        
        # Step 4: Perform similarity search to find matches
        logger.info(f"Performing similarity search with formatted query: {formatted_query}")
        similar_images = await perform_similarity_search(
            formatted_query, match_count=4, client=client
        )
        
        if not similar_images:
            logger.warning("No matching images found")
            return {
                "search_id": search_id,
                "query": query,
                "extracted_details": extracted_details,
                "formatted_query": formatted_query,
                "formatting_explanation": formatting_explanation,
                "matches": []
            }
        
        # Step 5: Generate reasoning for each match
        logger.info(f"Generating reasoning for {len(similar_images)} matches")
        matches_with_reasoning = []
        
        for match in similar_images:
            reasoning_stream = await generate_reasoning(
                query=query,
                extracted_details=extracted_details,
                formatted_query=formatted_query,
                similar_image_analysis=match["photo_analysis"],
                image_analysis=image_analysis,
                client=client
            )
            reasoning_response = await collect_stream_content(reasoning_stream)
            
            # Parse reasoning JSON response
            try:
                reasoning_data = json.loads(reasoning_response)
                reasons = reasoning_data["reasons"]
            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"Error parsing reasoning response: {e}")
                reasons = ["Unable to determine reasoning for this match"]
            
            matches_with_reasoning.append({
                "id": match["id"],
                "photo_url": match["photo_url"],
                "similarity": match["similarity"],
                "rank": match["rank"],
                "reasons": reasons
            })
        
        # Return final results
        return {
            "search_id": search_id,
            "query": query,
            "extracted_details": extracted_details,
            "formatted_query": formatted_query,
            "formatting_explanation": formatting_explanation,
            "matches": matches_with_reasoning
        }
    except Exception as e:
        logger.error(f"Error in search process: {str(e)}", exc_info=True)
        raise