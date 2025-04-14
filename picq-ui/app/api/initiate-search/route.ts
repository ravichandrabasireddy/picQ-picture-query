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

        // Make a request to the external API using environment variables
        const response = await fetch(`${process.env.PICQ_BACKEND_URI}${process.env.PICQ_IMAGE_SEARCH}`, {
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

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`API request failed with status ${response.status}: ${errorText}`)

          // Send error event to client immediately
          const errorEvent = `event: error\ndata: ${JSON.stringify({
            message: `API request failed with status ${response.status}`,
            details: errorText,
          })}\n\n`

          controller.enqueue(encoder.encode(errorEvent))
          controller.close()
          return
        }

        // Set up a reader for the response body
        const reader = response.body?.getReader()
        if (!reader) {
          console.error("Failed to get response reader")

          // Send error event to client
          const errorEvent = `event: error\ndata: ${JSON.stringify({
            message: "Failed to get response reader",
          })}\n\n`

          controller.enqueue(encoder.encode(errorEvent))
          controller.close()
          return
        }

        console.log("Successfully connected to search stream")

        // Process the stream
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            console.log("Stream complete")
            break
          }

          // Decode the chunk and add it to the buffer
          const chunk = decoder.decode(value, { stream: true })
          console.log("Received chunk:", chunk)
          buffer += chunk

          // Process complete events in the buffer
          let eventEnd = buffer.indexOf("\n\n")
          while (eventEnd >= 0) {
            const eventData = buffer.substring(0, eventEnd)
            buffer = buffer.substring(eventEnd + 2)

            // Parse the event data
            const eventLines = eventData.split("\n")
            let event = "message"
            let data = ""

            for (const line of eventLines) {
              if (line.startsWith("event: ")) {
                event = line.substring(7)
              } else if (line.startsWith("data: ")) {
                data = line.substring(6)
              }
            }

            // Forward the event to the client immediately
            const eventOutput = `event: ${event}\ndata: ${data}\n\n`
            controller.enqueue(encoder.encode(eventOutput))
            console.log(`Forwarding event: ${event}`)

            // Flush the stream to ensure immediate delivery
            try {
              // @ts-ignore - This is a non-standard method but works in some environments
              if (controller.flush) {
                // @ts-ignore 
                await controller.flush()
              }
            } catch (e) {
              // Ignore flush errors
            }

            // Check for the next event
            eventEnd = buffer.indexOf("\n\n")
          }
        }

        // Process any remaining data in the buffer
        if (buffer.length > 0) {
          console.log("Processing remaining buffer data:", buffer)

          // Try to parse as an event if possible
          if (buffer.includes("event: ")) {
            const eventLines = buffer.split("\n")
            let event = "message"
            let data = ""

            for (const line of eventLines) {
              if (line.startsWith("event: ")) {
                event = line.substring(7)
              } else if (line.startsWith("data: ")) {
                data = line.substring(6)
              }
            }

            const eventOutput = `event: ${event}\ndata: ${data}\n\n`
            controller.enqueue(encoder.encode(eventOutput))
          } else {
            // Otherwise send as generic message
            controller.enqueue(encoder.encode(`data: ${buffer}\n\n`))
          }
        }

        controller.close()
      } catch (error) {
        console.error("Error in SSE stream:", error)

        // Send error event to client
        const errorEvent = `event: error\ndata: ${JSON.stringify({
          message: "Internal server error",
          details: error instanceof Error ? error.message : String(error),
        })}\n\n`

        controller.enqueue(encoder.encode(errorEvent))
        controller.close()
      }
    },
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
