/**
 * Utility for handling Server-Sent Events (SSE) with proper event handling
 */

type SSEEventCallback = (data: any) => void

interface SSEClientOptions {
  onOpen?: () => void
  onError?: (error: Event) => void
  onMessage?: (data: any) => void
  onClose?: () => void
}

export class SSEClient {
  private eventSource: EventSource | null = null
  private eventHandlers: Map<string, SSEEventCallback[]> = new Map()
  private url: string
  private options: SSEClientOptions
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor(url: string, options: SSEClientOptions = {}) {
    this.url = url
    this.options = options
  }

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this.eventSource) {
      this.close()
    }

    console.log(`[SSE] Connecting to ${this.url}`)
    this.eventSource = new EventSource(this.url)

    // Set up basic event handlers
    this.eventSource.onopen = () => {
      console.log("[SSE] Connection opened")
      this.reconnectAttempts = 0
      if (this.options.onOpen) {
        this.options.onOpen()
      }
    }

    this.eventSource.onerror = (error) => {
      console.error("[SSE] Connection error:", error)
      if (this.options.onError) {
        this.options.onError(error)
      }

      // Handle reconnection
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.handleReconnect()
      }
    }

    this.eventSource.onmessage = (event) => {
      try {
        const data = event.data ? JSON.parse(event.data) : null
        console.log("[SSE] Generic message received:", data)
        if (this.options.onMessage) {
          this.options.onMessage(data)
        }
      } catch (error) {
        console.error("[SSE] Error parsing message data:", error, event.data)
      }
    }

    // Re-register all event handlers
    this.eventHandlers.forEach((callbacks, eventName) => {
      callbacks.forEach((callback) => {
        this.eventSource?.addEventListener(eventName, (event) => {
          try {
            const data = event.data ? JSON.parse(event.data) : null
            console.log(`[SSE] Event '${eventName}' received:`, data)
            callback(data)
          } catch (error) {
            console.error(`[SSE] Error parsing '${eventName}' data:`, error, event.data)
          }
        })
      })
    })
  }

  /**
   * Register an event handler
   */
  on(eventName: string, callback: SSEEventCallback): void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, [])
    }

    this.eventHandlers.get(eventName)?.push(callback)

    // If already connected, add the event listener immediately
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      this.eventSource.addEventListener(eventName, (event) => {
        try {
          const data = event.data ? JSON.parse(event.data) : null
          console.log(`[SSE] Event '${eventName}' received:`, data)
          callback(data)
        } catch (error) {
          console.error(`[SSE] Error parsing '${eventName}' data:`, error, event.data)
        }
      })
    }
  }

  /**
   * Close the SSE connection
   */
  close(): void {
    if (this.eventSource) {
      console.log("[SSE] Closing connection")
      this.eventSource.close()
      this.eventSource = null

      if (this.options.onClose) {
        this.options.onClose()
      }
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.pow(2, this.reconnectAttempts) * 1000 // Exponential backoff

      console.log(
        `[SSE] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`,
      )

      setTimeout(() => {
        this.connect()
      }, delay)
    } else {
      console.error("[SSE] Max reconnection attempts reached")
      if (this.options.onError) {
        this.options.onError(new Event("max_reconnect_attempts_reached"))
      }
    }
  }

  /**
   * Check if the connection is active
   */
  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN
  }
}
