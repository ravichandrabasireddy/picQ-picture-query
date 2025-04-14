import { type NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  context: { params: { matchid: string } }
) {
  try {
    // Get the match ID from the URL parameters - with await
    const { matchid } = await context.params
    console.log("Match ID:", matchid)
    if (!matchid) {
      return NextResponse.json(
        {
          success: false,
          error: "Match ID is required",
        },
        { status: 400 }
      )
    }

    // Make a request to the external API using environment variables
    const response = await fetch(`${process.env.PICQ_BACKEND_URI}${process.env.PICQ_GET_CHAT_BY_MATCH}${matchid}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    // Get the response data
    const data = await response.json()

    // Return the response
    return NextResponse.json(data)
  } catch (error) {
    console.error("Chat history API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch chat history",
      },
      { status: 500 },
    )
  }
}
