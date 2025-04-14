# picQ - Intelligent Visual Discovery

picQ is an advanced natural language photo search system that allows users to search through images using both text queries and image uploads. Powered by a sophisticated multi-agent workflow leveraging Google's Generative AI, picQ enables intelligent visual discovery through personal photo libraries.

## 🌟 Key Features

- **Multimodal Search**: Query your photo library using natural language text or image uploads
- **AI-Powered Analysis**: Multi-agent system extracts information and analyzes images using Google Gemini 2.0
- **Smart Results**: Returns a top match with three additional similar results, each with AI reasoning
- **Detailed Insights**: View comprehensive metadata and interesting details about each photo
- **Interactive Q&A**: Ask questions about any photo with conversation history support
- **Save & Share**: Save favorite matches and share search results with others
- **Vector Database**: Leverages vector embeddings for efficient similarity search
- **Real-time Processing**: Live updates during search processing with step-by-step feedback

## 🏗️ Architecture

picQ follows a sophisticated architecture consisting of:

1. **Frontend (Next.js)**
   - Responsive UI with dark mode support
   - Real-time search progress tracking via Server-Sent Events
   - Image and search history management
   - Interactive photo details dialog

2. **Backend (FastAPI)**
   - Multiple specialized AI agents:
     - Query Extract Agent: Parses user queries for intents
     - Format Query Agent: Structures queries for vector search
     - Photo Feature Extract Agent: Analyzes image content
     - Reasoning Agent: Explains image matches
     - Answering Agent: Responds to questions about photos
   - Photo processing engine with metadata extraction
   - Vector database integration for similarity search
   - Bulk photo ingestion capabilities

## 💻 Technical Stack

### Frontend
- Next.js 15.x with React 19
- Tailwind CSS for styling
- shadcn/ui component library
- Server-Sent Events for real-time updates

### Backend
- FastAPI (Python)
- Google Generative AI (Gemini 2.0/2.5 Pro models)
- Supabase for data storage
- Vector embeddings for similarity search
- Google Maps API for reverse geocoding

## 🚀 Getting Started

### Prerequisites
- Python 3.8+ (for backend)
- Node.js 18+ (for frontend)
- Supabase account
- Google Generative AI API key
- Google Maps API key (optional, for geocoding)

### Backend Setup
1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/picQ-picture-query.git
   cd picQ-picture-query/picq-server
   ```

2. Set up environment variables
   ```
   ENV=dev
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_api_key
   GEOCODING_URI_BASE=https://maps.googleapis.com/maps/api/geocode/json
   GEOCODING_API_KEY=your_geocoding_api_key  # Optional
   ```

3. Install dependencies and run
   ```bash
   pip install -r requirements.txt
   uvicorn app.api.server:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup
1. Navigate to the frontend directory
   ```bash
   cd ../picq-ui
   ```

2. Set up environment variables
   ```
   PICQ_BACKEND_URI="https://picq-server.ravichandra.dev"
   PICQ_IMAGE_SEARCH="/search"
   PICQ_PICTURE_CHAT="/chat/"
   PICQ_SEARCH_INSERT="/db/insert/searches"
   PICQ_SEARCH_RESULTS="/db/search_results/"
   PICQ_GET_CHAT_BY_MATCH="/db/chats/match/"
   ```

3. Install dependencies and run
   ```bash
   npm install
   npm run dev
   ```

### Photo Ingestion
To ingest your own photos into the system:

```bash
# From the picq-server directory
python app/bulk_ingest.py /path/to/your/photos
```

## 🔧 Unique Implementation Highlights

- **Multi-Agent Workflow**: Rather than a single AI model, picQ uses specialized agents working together, each optimized for specific tasks in the pipeline
- **Reverse Geo Encoding**: Automatically extracts and enhances location data from photo metadata
- **Real-time Processing Updates**: Server-Sent Events provide a transparent view of the AI processing steps
- **Image Content Analysis**: Extracts subjects, scenes, emotions, and interesting details from photos
- **Query Transformation**: Converts natural language into optimized vector search parameters
- **Reasoned Matches**: Every match includes AI reasoning explaining why it was selected

## 📦 Dependencies

- **Google Generative AI API**: Powers all AI agents using Gemini models
- **Supabase**: Database and vector store for photo data and metadata
- **Google Maps API**: Used for reverse geocoding of photo coordinates
- **Next.js**: Frontend framework
- **FastAPI**: Backend framework
- **Tailwind CSS & shadcn/ui**: UI component system

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- Built with Google's Generative AI capabilities
- UI components by [shadcn/ui](https://ui.shadcn.com/)
- Vector search powered by Supabase
- Icons from [Lucide React](https://lucide.dev/icons/)
