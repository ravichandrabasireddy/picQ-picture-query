"use client"

import { useEffect, useState, useRef } from "react"
import { CheckCircle2 } from "lucide-react"
import { SSEClient } from "@/lib/sse-client"

// Define the stages that will be tracked
const STAGES = [
  { key: "checking_results", label: "Checking Results" },
  { key: "extract_query", label: "Query Analysis" },
  { key: "image_analysis", label: "Image Analysis" },
  { key: "query_formatting", label: "Query Formatting" },
  { key: "similarity_search", label: "Similarity Search" },
  { key: "match_analysis", label: "Match Analysis" },
]

type Status = "waiting" | "in-progress" | "completed"

type SSEProgressTrackerProps = {
  searchId?: string
  query?: string
  imageUrl?: string
  onComplete?: (success: boolean) => void
}

export default function SSEProgressTrackerWithChunks({
  searchId = "",
  query = "",
  imageUrl = "",
  onComplete,
}: SSEProgressTrackerProps) {
  // Status map to track the state of each stage
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({
    checking_results: "completed", // We assume checking is already done when this component is shown
    extract_query: "waiting",
    image_analysis: "waiting",
    query_formatting: "waiting",
    similarity_search: "waiting",
    match_analysis: "waiting",
  })

  // Store the accumulated chunks of text for display
  const [chunks, setChunks] = useState<string[]>([])
  
  // Track which stage has active chunks
  const [activeChunkStage, setActiveChunkStage] = useState<string>("extract_query")
  
  // Store the SSE client instance
  const sseClientRef = useRef<SSEClient | null>(null)

  useEffect(() => {
    if (!searchId) return

    // Helper to set the status of a particular stage
    const setStatus = (key: string, status: Status) => {
      setStatusMap((prev) => ({ ...prev, [key]: status }))
    }

    // Function to start the SSE connection
    const startSSEConnection = () => {
      // Create the URL with parameters
      const params = new URLSearchParams()
      if (searchId) params.append("id", searchId)
      if (query) params.append("query", query)
      if (imageUrl) params.append("image", imageUrl)
      
      const eventSourceUrl = `/api/initiate-search?${params.toString()}`
      console.log("Connecting to SSE:", eventSourceUrl)
      
      // Create the SSE client
      const sseClient = new SSEClient(eventSourceUrl, {
        onOpen: () => console.log("SSE connection opened"),
        onError: (error) => console.error("SSE error:", error),
        onClose: () => console.log("SSE connection closed"),
      })
      
      // Store the client reference
      sseClientRef.current = sseClient

      // Extract Query events
      sseClient.on("extract_query_start", () => {
        setStatus("extract_query", "in-progress")
        setActiveChunkStage("extract_query")
        setChunks([]) // Reset chunks when starting this stage
      })

      sseClient.on("extract_query_chunk", (data) => {
        if (data.chunk) {
          setChunks((prev) => [...prev, data.chunk])
        }
      })

      sseClient.on("extract_query_complete", () => {
        setStatus("extract_query", "completed")
      })

      // Image Analysis events
      sseClient.on("image_analysis_start", () => {
        setStatus("image_analysis", "in-progress")
        setActiveChunkStage("image_analysis")
        setChunks([]) // Reset chunks for this stage
      })

      sseClient.on("image_analysis_chunk", (data) => {
        if (data.chunk) {
          setChunks((prev) => [...prev, data.chunk])
        }
      })

      sseClient.on("image_analysis_complete", () => {
        setStatus("image_analysis", "completed")
      })

      // Query Formatting events
      sseClient.on("format_query_start", () => {
        setStatus("query_formatting", "in-progress")
        setActiveChunkStage("query_formatting")
        setChunks([]) // Reset chunks for this stage
      })

      sseClient.on("format_query_chunk", (data) => {
        if (data.chunk) {
          setChunks((prev) => [...prev, data.chunk])
        }
      })

      sseClient.on("format_query_complete", () => {
        setStatus("query_formatting", "completed")
      })

      // Search events
      sseClient.on("search_start", () => {
        setStatus("similarity_search", "in-progress")
      })

      sseClient.on("search_complete", () => {
        setStatus("similarity_search", "completed")
      })

      // Match Analysis events
      sseClient.on("reasoning_start", () => {
        setStatus("match_analysis", "in-progress")
      })

      sseClient.on("reasoning_progress", (data) => {
        // Update progress message if needed
        console.log("Reasoning progress:", data.message)
      })

      sseClient.on("reasoning_complete", () => {
        setStatus("match_analysis", "completed")
      })

      // Final completion event
      sseClient.on("complete", (data) => {
        console.log("Search complete:", data)
        if (onComplete) {
          onComplete(data.success)
        }
        
        // Cleanup: close the connection
        setTimeout(() => sseClient.close(), 1000)
      })

      // Start the connection
      sseClient.connect()
    }

    // Start the SSE connection
    startSSEConnection()

    // Cleanup function
    return () => {
      if (sseClientRef.current) {
        sseClientRef.current.close()
        sseClientRef.current = null
      }
    }
  }, [searchId, query, imageUrl, onComplete])

  return (
    <div className="p-6 max-w-2xl mx-auto text-white font-sans">
      <h2 className="text-lg font-bold mb-4">Processing Your Query</h2>
      <ul className="space-y-4">
        {STAGES.map(({ key, label }) => {
          const status = statusMap[key]
          const isActiveChunkStage = activeChunkStage === key

          return (
            <li
              key={key}
              className="bg-zinc-900 border border-zinc-700 p-4 rounded-lg"
            >
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  {status === "completed" ? (
                    <CheckCircle2 className="text-green-500 w-4 h-4" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-500" />
                  )}
                  <span className="font-medium">{label}</span>
                </div>
                <span className="text-sm text-gray-400 capitalize">
                  {status === "waiting" && "Waiting..."}
                  {status === "in-progress" && "In Progress"}
                  {status === "completed" && "Completed"}
                </span>
              </div>

              {isActiveChunkStage && chunks.length > 0 && (
                <div className="mt-2 bg-zinc-800 p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {chunks.map((chunk, i) => (
                    <span key={i}>{chunk}</span>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}