import json
import asyncio
from typing import Dict, Any, AsyncGenerator, Optional

from fastapi import HTTPException
from google import genai

from ...core.logging_config import setup_logging
from ...core.config import get_settings
from ...core.database import get_supabase_client
from ..agents.question_answering_agent import generate_answer

logger = setup_logging()

async def collect_stream_content(stream):
    """Helper function to yield content from a stream which may be a generator or async generator"""
    content = ""
    try:
        async for chunk in stream:
            if hasattr(chunk, 'text') and chunk.text is not None:
                content += chunk.text
                yield {"chunk": chunk.text}
    except TypeError:
        # If that fails, it might be a regular generator
        for chunk in stream:
            if hasattr(chunk, 'text') and chunk.text is not None:
                content += chunk.text
                yield {"chunk": chunk.text}
    
    # Return complete content at the end
    yield {"complete": content}

async def chat_message_stream(match_id: str, question: str) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process a user question about a specific photo match, generate an answer,
    and store both in chat history.
    
    Args:
        match_id: ID of the match the user is asking about
        question: The user's question about the photo
        
    Yields:
        Dict containing response chunks and status information
    """
    try:
        # Initialize shared client to reuse across API calls
        settings = get_settings()
        client = genai.Client(api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY)
        supabase = get_supabase_client()
        
        # Step 1: Get match information and photo analysis
        logger.info(f"Getting match information for match ID: {match_id}")
        yield {"event": "processing", "data": json.dumps({"message": "Getting match details..."})}
        
        match_query = supabase.table('matches') \
            .select('*, photos(id, photo_analysis)') \
            .eq('id', match_id) \
            .execute()
            
        if not match_query.data or len(match_query.data) == 0:
            error_msg = f"Match with ID {match_id} not found"
            logger.error(error_msg)
            yield {"event": "error", "data": json.dumps({"message": error_msg})}
            return
            
        match_info = match_query.data[0]
        photo_analysis = match_info['photos']['photo_analysis'] if match_info['photos'] else ""
        
        if not photo_analysis:
            error_msg = "No photo analysis available for this match"
            logger.error(error_msg)
            yield {"event": "error", "data": json.dumps({"message": error_msg})}
            return
        
        # Step 2: Get or create user_chat
        user_chat_query = supabase.table('user_chats') \
            .select('id') \
            .eq('match_id', match_id) \
            .execute()
            
        if not user_chat_query.data or len(user_chat_query.data) == 0:
            # Create new user_chat
            new_chat = supabase.table('user_chats') \
                .insert({"match_id": match_id}) \
                .execute()
                
            if not new_chat.data or len(new_chat.data) == 0:
                error_msg = "Failed to create chat"
                logger.error(error_msg)
                yield {"event": "error", "data": json.dumps({"message": error_msg})}
                return
                
            user_chat_id = new_chat.data[0]['id']
        else:
            user_chat_id = user_chat_query.data[0]['id']
        
        # Step 3: Get chat history
        logger.info(f"Getting chat history for user_chat ID: {user_chat_id}")
        chat_history_query = supabase.table('chat_messages') \
            .select('id, is_user, message_text, created_at') \
            .eq('user_chat_id', user_chat_id) \
            .order('created_at', desc=False) \
            .execute()
            
        chat_history = chat_history_query.data if chat_history_query.data else []
        
        # Step 4: Store user question in chat history
        logger.info(f"Storing user question in chat history")
        question_insert = supabase.table('chat_messages') \
            .insert({
                "user_chat_id": user_chat_id,
                "is_user": True,
                "message_text": question
            }) \
            .execute()
            
        if not question_insert.data or len(question_insert.data) == 0:
            logger.warning("Failed to store user question in chat history")
        
        # Step 5: Generate answer
        logger.info(f"Generating answer to question: {question}")
        yield {"event": "generating", "data": json.dumps({"message": "Generating answer..."})}
        
        answer_stream = await generate_answer(
            question=question,
            chat_history=chat_history,
            photo_analysis=photo_analysis,
            client=client
        )
        
        # Step 6: Stream response to client
        full_answer = ""
        yield {"event": "answer_start", "data": json.dumps({"message": "Starting answer stream"})}
        
        async for chunk_data in collect_stream_content(answer_stream):
            if "chunk" in chunk_data:
                chunk = chunk_data["chunk"]
                full_answer += chunk
                yield {"event": "answer_chunk", "data": json.dumps({"chunk": chunk})}
            elif "complete" in chunk_data:
                full_answer = chunk_data["complete"]
        
        # Step 7: Store AI answer in chat history
        logger.info("Storing AI response in chat history")
        answer_insert = supabase.table('chat_messages') \
            .insert({
                "user_chat_id": user_chat_id,
                "is_user": False,
                "message_text": full_answer
            }) \
            .execute()
            
        if not answer_insert.data or len(answer_insert.data) == 0:
            logger.warning("Failed to store AI answer in chat history")
        
        # Return completion message
        yield {"event": "complete", "data": json.dumps({
            "message": "Answer generation complete",
            "answer": full_answer
        })}
        
    except Exception as e:
        error_msg = f"Error generating answer: {str(e)}"
        logger.error(error_msg, exc_info=True)
        yield {"event": "error", "data": json.dumps({"message": error_msg})}