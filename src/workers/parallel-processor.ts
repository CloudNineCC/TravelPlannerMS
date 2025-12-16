import { Worker } from 'worker_threads'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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

export async function executeInWorker(tasks: Task[]): Promise<Result[]> {
  return new Promise((resolve, reject) => {
    const workerPath = process.env.NODE_ENV === 'production'
      ? join(__dirname, 'worker.js')
      : join(__dirname, 'worker.js')

    const worker = new Worker(workerPath, {
      workerData: { tasks }
    })

    worker.on('message', (results: Result[]) => {
      worker.terminate()
      resolve(results)
    })

    worker.on('error', (error) => {
      worker.terminate()
      reject(error)
    })

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`))
      }
    })
  })
}
