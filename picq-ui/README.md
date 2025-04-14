# picQ - Intelligent Visual Discovery


picQ is an AI-powered image search application built with Next.js that enables users to find images through natural language queries and image uploads. The application uses advanced AI to analyze queries and images to find the most relevant visual matches.

## Features

- **Multimodal Search**: Search using both text descriptions and image uploads
- **AI-Powered Matching**: Intelligent matching of search queries to relevant images
- **Real-time Processing**: Live updates during search processing with step-by-step feedback
- **Saved Images**: Save favorite images for future reference
- **Recent Searches**: Track and easily access previous searches
- **Visual Inspiration**: Pre-defined search suggestions for inspiration
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Dark Mode Support**: Toggle between light and dark themes

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm, yarn, pnpm, or bun package manager
- Access to the picQ backend service (or a development backend)

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```
PICQ_BACKEND_URI="https://picq-server.ravichandra.dev"
PICQ_IMAGE_SEARCH="/search"
PICQ_PICTURE_CHAT="/chat/"
PICQ_SEARCH_INSERT="/db/insert/searches"
PICQ_SEARCH_RESULTS="/db/search_results/"
PICQ_GET_CHAT_BY_MATCH="/db/chats/match/"
```



### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/picQ-picture-query.git
cd picQ-picture-query/picq-ui

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### Development Server

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Architecture

The application is built using:

- **Next.js 15.x**: React framework for server and client components
- **React 19**: For building the user interface
- **Tailwind CSS**: For styling components
- **shadcn/ui**: Component library based on Radix UI primitives
- **Server-Sent Events (SSE)**: For real-time updates during search processing

### Key Components

- `pic-q-search.tsx`: Main search component with text and image input
- `search/[id]/page.tsx`: Search results page showing matches
- `image-detail-dialog.tsx`: Detailed view of selected images
- `recent-searches.ts`: Management of search history
- `saved-images.ts`: Functionality for saving favorite images
- `sse-client.ts`: Client for handling server-sent events

## Deployment

This Next.js application can be deployed using [Vercel](https://vercel.com) or any other hosting service that supports Next.js applications.

For Vercel deployment:

1. Push your code to a GitHub, GitLab, or Bitbucket repository
2. Import the project in Vercel
3. Configure the environment variables
4. Deploy

## License

[Add your license information here]

## Acknowledgements

- Built with [Next.js](https://nextjs.org/)
- UI components by [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide React](https://lucide.dev/icons/)
