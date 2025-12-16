import { parentPort, workerData } from 'worker_threads'

interface Task {
  type: 'fetch'
  url: string
  method?: 'GET' | 'POST'
  body?: any
}

interface Result {
  success: boolean
  data?: any
  error?: string
}

async function executeTask(task: Task): Promise<Result> {
  try {
    const options: RequestInit = {
      method: task.method || 'GET'
    }

    if (task.body) {
      options.headers = { 'Content-Type': 'application/json' }
      options.body = JSON.stringify(task.body)
    }

    const response = await fetch(task.url, options)

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }

    const data = await response.json()
    return {
      success: true,
      data
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}

async function processTasks() {
  const tasks: Task[] = workerData.tasks

  try {
    const results = await Promise.all(tasks.map(executeTask))

    if (parentPort) {
      parentPort.postMessage(results)
    }
  } catch (error: any) {
    if (parentPort) {
      parentPort.postMessage([{
        success: false,
        error: error.message || 'Worker execution failed'
      }])
    }
  }
}

processTasks()
