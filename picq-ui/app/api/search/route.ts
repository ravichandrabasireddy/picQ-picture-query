import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // Get the form data from the request
    const formData = await request.formData()
    // Forward the request to the external API using environment variables
    const response = await fetch(`${process.env.PICQ_BACKEND_URI}${process.env.PICQ_SEARCH_INSERT}`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    // Get the response data
    const data = await response.json()

    // Return the response
    return NextResponse.json(data)
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process search request",
      },
      { status: 500 },
    )
  }
}
