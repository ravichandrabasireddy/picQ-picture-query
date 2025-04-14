import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Await the params object before accessing its properties
    const searchId = (await params).id

    // Make a GET request to the external API
    const response = await fetch(`http://localhost:8000/db/search_results/${searchId}`, {
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
    console.error("Search results API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch search results",
      },
      { status: 500 },
    )
  }
}
