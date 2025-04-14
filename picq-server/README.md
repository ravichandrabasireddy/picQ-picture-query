# picQ - Picture Query API

A FastAPI-based server for picture querying and analysis using Google's Generative AI.

## Project Overview

picQ is an API service that allows users to:
- Upload and store photos
- Query and analyze image content
- Extract information and answer questions about photos
- Search across photo collections
- Bulk ingest multiple photos from a directory

## Requirements

- Python 3.8+
- FastAPI
- Uvicorn
- Google Generative AI API key
- Supabase account and credentials

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/picQ-picture-query.git
cd picQ-picture-query/picq-server
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Configuration

Create a `.env` file in the picq-server directory with the following variables:

```
ENV=dev
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key
GEOCODING_URI_BASE=https://maps.googleapis.com/maps/api/geocode/json
GEOCODING_API_KEY=your_geocoding_api_key  # Optional
```

## Running the Server

To start the server:

```bash
uvicorn app.api.server:app --host 0.0.0.0 --port 8000 --reload
```

The server will start at `http://0.0.0.0:8000`. You can access:
- API documentation: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Production Mode

For production deployment:

1. Set `ENV=prod` in your `.env` file
2. Run the server without the reload flag:

```bash
uvicorn app.api.server:app --host 0.0.0.0 --port 8000
```

## Bulk Image Ingestion (Optional)

The picQ server includes a bulk ingestion tool that allows you to upload and analyze multiple images from a directory:

```bash
# Basic usage
python app/bulk_ingest.py /path/to/your/images

# With custom API URL
python app/bulk_ingest.py /path/to/your/images --api-url http://localhost:8000/photo/analyze

# Adjust concurrent requests (default is 10)
python app/bulk_ingest.py /path/to/your/images --max-concurrent 5
```

If you run the script without specifying a folder path, it will prompt you to enter one:

```bash
python app/bulk_ingest.py
# You'll be prompted: "Please enter the path to the folder containing images:"
```

The tool will:
1. Scan the directory recursively for image files
2. Upload each valid image to the API endpoint
3. Display a progress bar and periodic status updates
4. Report success and failure counts upon completion

Supported image formats include: JPEG, PNG, GIF, WebP, TIFF, BMP, and HEIC.

## Project Structure

```
picq-server/
├── app/
│   ├── api/
│   │   ├── agents/          # AI agents for different tasks
│   │   ├── photo_engine/    # Photo handling components
│   │   ├── query_engine/    # Query processing components
│   │   ├── routes/          # API endpoints
│   │   ├── middleware.py    # API middleware
│   │   └── server.py        # FastAPI application setup
│   ├── core/
│   │   ├── config.py        # Application configuration
│   │   ├── database.py      # Database connection
│   │   └── logging_config.py # Logging setup
│   ├── migrations/          # Database migrations
│   ├── models/              # Data models
│   └── main.py             # Application entry point
├── logs/                   # Log files
└── requirements.txt        # Dependencies
```

## API Endpoints

- `/health`: Health check endpoint
- `/photo`: Photo upload and management
- `/query`: Picture querying capabilities
- `/db`: Database operations

## Development

To contribute to this project:

1. Create a feature branch
2. Implement your changes
3. Add tests where applicable 
4. Submit a pull request

## License

MIT License

Copyright (c) 2025 picQ Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.