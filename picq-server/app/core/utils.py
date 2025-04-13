import aiohttp
import tempfile
import os
from typing import Optional

async def download_image(url: str) -> str:
    """Download image from URL and save to a temporary file.
    
    Args:
        url: URL of the image to download
        
    Returns:
        Path to the downloaded temporary file
        
    Raises:
        Exception: If the download fails
    """
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status == 200:
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
                temp_file_path = temp_file.name
                
                with open(temp_file_path, 'wb') as f:
                    f.write(await response.read())
                
                return temp_file_path
            else:
                raise Exception(f"Failed to download image: {response.status}")