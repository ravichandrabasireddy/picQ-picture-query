import os
from google import genai
from google.genai import types

from ...core.prompts import get_format_query_prompt
from ...core.config import get_settings

async def generate_format_query(original_query: str, extracted_details: str, image_analysis: str = None, client=None):
    """Generate formatted query using Gemini API.
    
    Args:
        original_query: The user's original search query
        extracted_details: Extracted details from the query
        image_analysis: Optional analysis of an image (if one was provided)
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
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=get_format_query_prompt(original_query, extracted_details, image_analysis)),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=types.Schema(
            type=types.Type.OBJECT,
            required=["formatted_query", "explanation"],
            properties={
                "formatted_query": types.Schema(
                    type=types.Type.STRING,
                ),
                "explanation": types.Schema(
                    type=types.Type.STRING,
                ),
            },
        ),
    )
    
    return client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    )