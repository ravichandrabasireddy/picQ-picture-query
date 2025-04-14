// Utility functions for debugging SSE events

/**
 * Logs SSE events for debugging purposes
 * @param eventName The name of the event
 * @param data The event data
 */
export function logSSEEvent(eventName: string, data: any): void {
    console.log(`%c[SSE Event] ${eventName}`, "color: #4CAF50; font-weight: bold;", data)
  }
  
  /**
   * Parses SSE event data safely
   * @param eventData The raw event data string
   * @returns Parsed JSON object or null if parsing fails
   */
  export function parseSSEData(eventData: string): any {
    try {
      if (!eventData) return null
      return JSON.parse(eventData)
    } catch (error) {
      console.error("Failed to parse SSE data:", error, eventData)
      return null
    }
  }
  
  /**
   * Creates a properly formatted SSE event string
   * @param eventName The name of the event
   * @param data The data to include in the event
   * @returns Formatted SSE event string
   */
  export function formatSSEEvent(eventName: string, data: any): string {
    const jsonData = typeof data === "string" ? data : JSON.stringify(data)
    return `event: ${eventName}\ndata: ${jsonData}\n\n`
  }
  