import type { NextRequest } from "next/server"

export async function POST(
  request: NextRequest,
  context: { params: { matchid: string } }
) {
  try {
    // Get the match ID from the URL parameters - with await
    const { matchid } = await context.params
    console.log("Match ID:", matchid)
    
    if (!matchid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Match ID is required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    // Get the request body
    const body = await request.json()

    // Validate the request body
    if (!body.message) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Message is required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    // Make a request to the external API using environment variables
    const response = await fetch(`${process.env.PICQ_BACKEND_URI}${process.env.PICQ_PICTURE_CHAT}${matchid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: body.message,
      }),
    })

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    // Set up streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Get the reader from the response body
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error("Failed to get response reader")
          }

          // Process the stream
          const decoder = new TextDecoder()
          let buffer = ""
          let fullText = ""

          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              // Stream is complete
              break
            }

            // Decode the chunk and add it to the buffer
            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk

            // Process complete events in the buffer
            let lineEnd = buffer.indexOf("\n")
            while (lineEnd >= 0) {
              const line = buffer.substring(0, lineEnd).trim()
              buffer = buffer.substring(lineEnd + 1)

              // Check if the line starts with "data: "
              if (line.startsWith("data: ")) {
                try {
                  // Parse the JSON data
                  const eventData = JSON.parse(line.substring(6))

                  // Forward the event to the client
                  controller.enqueue(encoder.encode(JSON.stringify(eventData) + "\n"))

                  // If this is an answer_chunk event, extract the chunk
                  if (eventData.event === "answer_chunk" && eventData.data) {
                    const dataObj = JSON.parse(eventData.data)
                    if (dataObj.chunk) {
                      fullText += dataObj.chunk
                    }
                  }
                } catch (error) {
                  console.error("Error parsing event data:", error, line)
                }
              }

              // Look for the next line
              lineEnd = buffer.indexOf("\n")
            }
          }

          // Process any remaining data in the buffer
          if (buffer.trim().startsWith("data: ")) {
            try {
              const eventData = JSON.parse(buffer.trim().substring(6))
              controller.enqueue(encoder.encode(JSON.stringify(eventData) + "\n"))
            } catch (error) {
              console.error("Error parsing final event data:", error, buffer)
            }
          }

          // Stream is complete
          controller.close()
        } catch (error) {
          console.error("Error in chat stream:", error)
          controller.error(error)
        }
      },
    })

    // Return the streaming response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Chat message API error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to send message",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
