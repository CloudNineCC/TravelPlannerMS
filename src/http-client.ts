// Simple HTTP client for calling other microservices
export class HttpClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} from ${url}`)
    }

    return response.json() as Promise<T>
  }

  async post<T>(path: string, body: any): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} from ${url}`)
    }

    return response.json() as Promise<T>
  }

  async put<T>(path: string, body: any): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} from ${url}`)
    }

    return response.json() as Promise<T>
  }

  async delete(path: string): Promise<void> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} from ${url}`)
    }
  }
}