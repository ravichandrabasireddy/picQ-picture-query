import json
import tempfile
import aiohttp
import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator
from pathlib import Path

from google import genai

from ...core.config import get_settings
from ...core.logging_config import setup_logging
from ...core.database import get_supabase_client
from ...core.utils import generate_embeddings
from ..agents.query_extract_agent import generate_query_extraction
from ..agents.photo_feature_extract_agent import generate_analysis
from ..agents.format_query_agent import generate_format_query
from ..agents.retrieve_agent import perform_similarity_search
from ..agents.reasoning_agent import generate_reasoning
from ..agents.intresting_details_agent import generate_intresting_details

logger = setup_logging()

async def collect_stream_content(stream):
    """Helper function to yield content from a stream which may be a generator or async generator"""
    # First, try treating it as an async generator
    try:
        async for chunk in stream:
            if hasattr(chunk, 'text') and chunk.text is not None:
                yield chunk.text
    except TypeError:
        # If that fails, it might be a regular generator
        for chunk in stream:
            if hasattr(chunk, 'text') and chunk.text is not None:
                yield chunk.text

async def search_stream(search_id: str, query: str, image_url: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Orchestrates the search process using query and optional image analysis,
    streaming results as Server-Sent Events for each step.
    
    Args:
        search_id: Unique identifier for this search
        query: The user's search query text
        image_url: Optional URL to an image to include in the search
        
    Yields:
        Dict containing event type and data for each step of the search process
    """
    # Initialize shared client to reuse across API calls
    settings = get_settings()
    client = genai.Client(api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY)
    supabase = get_supabase_client()
    
    try:
        # Step 1: Extract query details
        logger.info(f"Extracting details from query: {query}")
        yield {"event": "extract_query_start", "data": json.dumps({"message": "Extracting details from query"})}
        
        query_extraction_stream = await generate_query_extraction(query, client)
        async for chunk in collect_stream_content(query_extraction_stream):
            yield {"event": "extract_query_chunk", "data": json.dumps({"chunk": chunk})}

        extracted_details = "".join([chunk async for chunk in collect_stream_content(query_extraction_stream)])
        yield {"event": "extract_query_complete", "data": json.dumps({
            "extracted_details": extracted_details
        })}
        
        # Step 2: Process image if provided
        image_analysis = None
        photo_id_to_update = None
        
        if image_url:
            logger.info(f"Processing image from URL: {image_url}")
            yield {"event": "image_analysis_start", "data": json.dumps({"message": "Processing image from URL"})}
            
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
                        async for chunk in collect_stream_content(image_analysis_stream):
                            yield {"event": "image_analysis_chunk", "data": json.dumps({"chunk": chunk})}

                        image_analysis = "".join([chunk async for chunk in collect_stream_content(image_analysis_stream)])
                        yield {"event": "image_analysis_complete", "data": json.dumps({
                            "image_analysis": image_analysis
                        })}
                        
                        # Store photo ID to update later (after search)
                        search_response = supabase.table('searches').select('photo_id').eq('id', search_id).execute()
                        if search_response.data and search_response.data[0]['photo_id']:
                            photo_id_to_update = search_response.data[0]['photo_id']
                            logger.info(f"Will update photo ID {photo_id_to_update} after search completes")
                    else:
                        error_msg = f"Failed to download image: {response.status}"
                        logger.error(error_msg)
                        yield {"event": "error", "data": json.dumps({"message": error_msg})}
        
        # Step 3: Generate formatted query
        logger.info("Generating formatted search query")
        yield {"event": "format_query_start", "data": json.dumps({"message": "Generating formatted search query"})}
        
        format_query_stream = await generate_format_query(
            query, extracted_details, image_analysis, client
        )
        formatted_query_response = ""
        async for chunk in collect_stream_content(format_query_stream):
            formatted_query_response += chunk
        
        # Parse the formatted query from JSON response
        try:
            formatted_query_data = json.loads(formatted_query_response)
            formatted_query = formatted_query_data["formatted_query"]
            formatting_explanation = formatted_query_data.get("explanation", "")
            logger.info(f"Formatted query: {formatted_query}")
            
            yield {"event": "format_query_complete", "data": json.dumps({
                "formatted_query": formatted_query,
                "explanation": formatting_explanation
            })}
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"Error parsing formatted query: {e}")
            formatted_query = query  # Fallback to original query
            formatting_explanation = "Error formatting query"
            yield {"event": "format_query_error", "data": json.dumps({
                "message": f"Error parsing formatted query: {str(e)}",
                "formatted_query": formatted_query
            })}
        
        # Step 4: Perform similarity search to find matches
        logger.info(f"Performing similarity search with formatted query: {formatted_query}")
        yield {"event": "search_start", "data": json.dumps({"message": "Performing similarity search"})}
        
        similar_images = await perform_similarity_search(
            formatted_query, match_count=4, client=client
        )
        
        # Create search_results entry
        search_result = supabase.table('search_results').insert({
            'search_id': search_id
        }).execute()
        
        if not search_result.data:
            logger.error("Failed to create search_result record")
            yield {"event": "error", "data": json.dumps({"message": "Failed to create search result record"})}
            return
            
        search_result_id = search_result.data[0]['id']
        logger.info(f"Created search_result with ID: {search_result_id}")
        
        if not similar_images:
            logger.warning("No matching images found")
            yield {"event": "search_complete", "data": json.dumps({
                "message": "No matching images found",
                "matches": []
            })}
            
            # Return final empty results
            yield {"event": "complete", "data": json.dumps({
                "search_id": search_id,
                "search_result_id": search_result_id,
                "query": query,
                "extracted_details": extracted_details,
                "formatted_query": formatted_query,
                "formatting_explanation": formatting_explanation,
                "matches": []
            })}
            
            # Still update the photo DB even if no matches found
            if photo_id_to_update and image_analysis:
                await update_photo_analysis(photo_id_to_update, image_analysis, client)
            
            return
        
        yield {"event": "search_complete", "data": json.dumps({
            "matches_count": len(similar_images)
        })}
        
        # Step 5: Generate reasoning for each match
        logger.info(f"Generating reasoning for {len(similar_images)} matches")
        yield {"event": "reasoning_start", "data": json.dumps({"message": "Generating reasoning for matches"})}
        
        matches_with_reasoning = []
        
        for i, match in enumerate(similar_images):
            yield {"event": "reasoning_progress", "data": json.dumps({
                "message": f"Processing match {i+1} of {len(similar_images)}"
            })}
            
            # Get match reasoning
            reasoning_stream = await generate_reasoning(
                query=query,
                extracted_details=extracted_details,
                formatted_query=formatted_query,
                similar_image_analysis=match["photo_analysis"],
                image_analysis=image_analysis,
                client=client
            )
            reasoning_response = ""
            async for chunk in collect_stream_content(reasoning_stream):
                reasoning_response += chunk
            
            # Parse reasoning JSON response
            try:
                reasoning_data = json.loads(reasoning_response)
                reasons = reasoning_data["reasons"]
            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"Error parsing reasoning response: {e}")
                reasons = ["Unable to determine reasoning for this match"]
            
            # Now get interesting details using the dedicated agent
            yield {"event": "interesting_details_progress", "data": json.dumps({
                "message": f"Generating interesting details for match {i+1}"
            })}
            
            interesting_details_stream = await generate_intresting_details(
                image_analysis=match["photo_analysis"],
                client=client
            )
            interesting_details_response = ""
            async for chunk in collect_stream_content(interesting_details_stream):
                interesting_details_response += chunk
            
            # Parse interesting details response
            try:
                details_data = json.loads(interesting_details_response)
                interesting_details = details_data.get("interesting_details", [])
                if isinstance(interesting_details, list):
                    interesting_details = "\n".join(interesting_details)
                explanation = details_data.get("explanation", "")
                logger.info(f"Generated interesting details for match {i+1}")
            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"Error parsing interesting details response: {e}")
                interesting_details = ""
            
            # Store match in database
            match_data = {
                "search_result_id": search_result_id,
                "photo_id": match["id"],
                "is_best_match": (match["rank"] == 0),  # Best match has rank 0
                "reason_for_match": "\n".join(reasons) if isinstance(reasons, list) else reasons,
                "interesting_details": interesting_details,
                "rank": match["rank"]
            }
            
            match_result = supabase.table('matches').insert(match_data).execute()
            
            if not match_result.data:
                logger.error(f"Failed to create match record for photo {match['id']}")
                continue
                
            match_id = match_result.data[0]['id']
            
            match_with_reason = {
                "id": match_id,
                "photo_id": match["id"],
                "photo_url": match["photo_url"],
                "similarity": match["similarity"],
                "rank": match["rank"],
                "reasons": reasons,
                "interesting_details": interesting_details.split("\n") if isinstance(interesting_details, str) else interesting_details
            }
            
            matches_with_reasoning.append(match_with_reason)
            
            yield {"event": "match_reasoning_complete", "data": json.dumps(match_with_reason)}
        
        yield {"event": "reasoning_complete", "data": json.dumps({
            "matches_count": len(matches_with_reasoning)
        })}
        
        # Return final results
        final_results = {
            "search_id": search_id,
            "search_result_id": search_result_id,
            "query": query,
            "extracted_details": extracted_details,
            "formatted_query": formatted_query,
            "formatting_explanation": formatting_explanation,
            "matches": matches_with_reasoning
        }
        
        yield {"event": "complete", "data": json.dumps(final_results)}
        
        # NOW update the photo DB at the very end
        # This ensures the current image wasn't included in the search
        if photo_id_to_update and image_analysis:
            await update_photo_analysis(photo_id_to_update, image_analysis, client)
        
    except Exception as e:
        error_msg = f"Error in search process: {str(e)}"
        logger.error(error_msg, exc_info=True)
        yield {"event": "error", "data": json.dumps({"message": error_msg})}

async def update_photo_analysis(photo_id: str, image_analysis: str, client):
    """Helper function to update photo analysis and generate embeddings"""
    try:
        supabase = get_supabase_client()
        
        # Generate embeddings for the image analysis
        embeddings = await generate_embeddings(image_analysis, client)
        
        # Update photo record with analysis and embeddings
        supabase.table('photos').update({
            'photo_analysis': image_analysis,
            'photo_analysis_vector': embeddings
        }).eq('id', photo_id).execute()
        
        logger.info(f"Updated photo {photo_id} with analysis and embeddings at end of search process")
    except Exception as e:
        logger.error(f"Failed to update photo analysis: {str(e)}")