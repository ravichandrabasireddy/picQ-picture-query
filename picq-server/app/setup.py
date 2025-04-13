from setuptools import setup, find_packages

setup(
    name="picq",
    version="0.2.0",
    author="Ravi Chandra",
    packages=find_packages(),
    install_requires=[
        "fastapi",
        "uvicorn",
        "pillow",
        "asyncio",
        "aiohttp",
        "tqdm",
        "google-genai",
        "supbase",
        "pydantic-settings"
            ],
)