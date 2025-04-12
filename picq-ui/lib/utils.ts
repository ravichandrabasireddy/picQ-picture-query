import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a UUID v4
export function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Mock API response for search results
export function getMockSearchResults(query: string) {
  return {
    bestMatch: {
      title: `Mountain landscapes with snow peaks`,
      image: "/placeholder.svg?height=400&width=600",
      reason: `This result closely matches your search for "${query}" because it contains similar visual elements and contextual information that aligns with your query.`,
    },
    otherMatches: [
      {
        title: `Alpine forest with snow-capped mountains`,
        image: "/placeholder.svg?height=300&width=400",
        reason: "This result shares color patterns and composition elements with your search criteria.",
      },
      {
        title: `Mountain lake reflecting snowy peaks`,
        image: "/placeholder.svg?height=300&width=400",
        reason: "This result matches the subject matter but with different stylistic elements.",
      },
      {
        title: `Sunset over mountain range with snow`,
        image: "/placeholder.svg?height=300&width=400",
        reason: "This result has similar contextual elements but with a different perspective.",
      },
    ],
  }
}

// Mock SSE for search process with text streaming
export function mockSearchProcess(
  query: string,
  callback: (event: string, data?: any) => void,
  textCallback: (text: string) => void,
) {
  const events = [
    {
      name: "photo_processing",
      delay: 1000,
      message: "Processing photo...",
      streamText: "Analyzing image composition and color patterns. Identifying key visual elements and subjects.",
    },
    {
      name: "extracting_details",
      delay: 1500,
      message: "Extracting visual details...",
      streamText:
        "Detected primary subjects and background elements. Identifying lighting conditions, style, and mood of the image.",
    },
    {
      name: "formatting_query",
      delay: 1200,
      message: "Formatting search query...",
      streamText: `Combining visual elements with text query "${query}". Prioritizing key terms and visual attributes for optimal search results.`,
    },
    {
      name: "retrieving",
      delay: 1800,
      message: "Retrieving results...",
      streamText:
        "Searching database for matching images. Ranking results by relevance and visual similarity. Preparing detailed explanations for each match.",
    },
    { name: "complete", delay: 1000, data: null },
  ]

  let totalDelay = 0
  let streamIntervals: NodeJS.Timeout[] = []

  events.forEach((event, index) => {
    totalDelay += event.delay

    setTimeout(() => {
      if (event.name === "complete") {
        callback(event.name)
      } else {
        callback(event.name, { message: event.message })

        // Text streaming for this step
        if (event.streamText) {
          const text = event.streamText
          let currentIndex = 0

          // Clear any existing intervals
          streamIntervals.forEach(clearInterval)
          streamIntervals = []

          // Start with empty text
          textCallback("")

          // Stream the text character by character
          const interval = setInterval(() => {
            if (currentIndex <= text.length) {
              textCallback(text.substring(0, currentIndex))
              currentIndex++
            } else {
              clearInterval(interval)
            }
          }, 30) // Adjust speed as needed

          streamIntervals.push(interval)
        }
      }
    }, totalDelay)
  })

  return () => {
    // Cleanup function
    streamIntervals.forEach(clearInterval)
  }
}
