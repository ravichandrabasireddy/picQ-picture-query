import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  // Get query parameters
  const searchId = request.nextUrl.searchParams.get("id") || ""
  const query = request.nextUrl.searchParams.get("query") || ""
  const image = request.nextUrl.searchParams.get("image") || ""

  // Set up Server-Sent Events response with proper headers
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log(`Initiating search with ID: ${searchId}, query: ${query}`)

        // Send initial connecting event to client
        controller.enqueue(encoder.encode(`event: connecting\ndata: ${JSON.stringify({ message: "Connecting to search API..." })}\n\n`))

        // Make a request to the external API using environment variables
        const apiUrl = `${process.env.PICQ_BACKEND_URI}${process.env.PICQ_IMAGE_SEARCH}`
        console.log(`Connecting to backend API: ${apiUrl}`)
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            id: searchId,
            query: query,
            image: image,
          }),
        })

        console.log(`Backend API response status: ${response.status}`)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`API request failed with status ${response.status}: ${errorText}`)

          // Send error event to client immediately
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
            message: `API request failed with status ${response.status}`,
            details: errorText,
          })}\n\n`))
          controller.close()
          return
        }

        console.log("Successfully connected to search stream")
        controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ message: "Search stream connected" })}\n\n`))

        // Simple direct approach using manual reading from the stream
        if (response.body) {
          const reader = response.body.getReader()
          let chunkCount = 0
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              
              if (done) {
                console.log(`Stream complete. Forwarded ${chunkCount} chunks directly.`)
                break
              }
              
              // Forward the chunk directly
              chunkCount++
              const textChunk = new TextDecoder().decode(value)
              console.log(`Forwarding CHUNK #${chunkCount}:`, textChunk.substring(0, 100) + (textChunk.length > 100 ? "..." : ""))
              
              // Pass the chunk through to the client without any modification
              controller.enqueue(value)
            }
            
            // Send a final event to signify successful completion
            controller.enqueue(encoder.encode(`event: stream_end\ndata: ${JSON.stringify({ 
              message: "Stream processing complete",
              chunks_forwarded: chunkCount
            })}\n\n`))
          } catch (readError) {
            console.error("Error reading from stream:", readError)
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
              message: "Error reading from stream",
              details: readError instanceof Error ? readError.message : String(readError)
            })}\n\n`))
          } finally {
            controller.close()
          }
        } else {
          throw new Error("Response body is null")
        }
      } catch (error) {
        console.error("Error in SSE stream:", error)
        
        // Send error event to client
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
          message: "Internal server error",
          details: error instanceof Error ? error.message : String(error)
        })}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable proxy buffering
    },
  })
}
