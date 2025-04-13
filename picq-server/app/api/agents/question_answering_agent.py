from typing import List, Dict, Any
from google import genai
from google.genai import types

from ...core.config import get_settings
from ...core.prompts import get_image_answering_prompt

async def generate_answer(
    question: str, 
    chat_history: List[Dict[str, Any]], 
    photo_analysis: str, 
    client=None
):
    """Generate an answer to a user question about a photo, incorporating chat history.
    
    Args:
        question: The user's current question
        chat_history: Previous chat messages in chronological order (oldest first)
        photo_analysis: Detailed analysis of the photo being discussed
        client: Google Generative AI client instance (if None, a new one will be created)
        
    Returns:
        Stream of content chunks from the Gemini API
    """
    if client is None:
        settings = get_settings()
        client = genai.Client(
            api_key=settings.GOOGLE_GENERATIVE_AI_API_KEY,
        )

    model = "gemini-2.0-flash"
    
    # Initialize conversation with system instructions
    conversation = []
    
    # Add chat history to build context
    for message in chat_history:
        if message["is_user"]:
            # For user messages, use the image answering prompt format
            prompt = get_image_answering_prompt(message["message_text"], photo_analysis)
            conversation.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=prompt)]
                )
            )
        else:
            # For model responses, just add them directly
            conversation.append(
                types.Content(
                    role="model",
                    parts=[types.Part.from_text(text=message["message_text"])]
                )
            )
    
    # Add the current question using the image answering prompt
    current_prompt = get_image_answering_prompt(question, photo_analysis)
    conversation.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=current_prompt)]
        )
    )
    
    # Configure generation parameters
    generate_content_config = types.GenerateContentConfig(
        response_mime_type="text/plain",
        temperature=0.3,
        top_p=0.8,
        top_k=40,
        max_output_tokens=300,
    )
    
    # If this is the first message (no history), use the standard approach
    if not chat_history:
        return client.models.generate_content_stream(
            model=model,
            contents=conversation,
            config=generate_content_config,
        )
    
    # For follow-up questions, use a modified approach that maintains context
    # We'll add a system message explaining this is a continuation
    context_message = """
This is a follow-up question in an ongoing conversation about a specific photo.
Previous questions and answers provide context for this response.
Ensure your answer is consistent with previous responses while addressing the current question.
"""
    
    # Insert context message at the beginning
    conversation.insert(0, 
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=context_message)]
        )
    )
    conversation.insert(1,
        types.Content(
            role="model", 
            parts=[types.Part.from_text(text="I'll provide consistent answers to follow-up questions about this photo.")]
        )
    )
    
    return client.models.generate_content_stream(
        model=model,
        contents=conversation,
        config=generate_content_config,
    )