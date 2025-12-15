const { parentPort, workerData } = require('worker_threads')

async function executeTask(task) {
  try {
    const options = {
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
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}

async function processTasks() {
  const tasks = workerData.tasks
  
  try {
    // Execute all tasks in parallel
    const results = await Promise.all(tasks.map(executeTask))
    
    // Send results back to main thread
    if (parentPort) {
      parentPort.postMessage(results)
    }
  } catch (error) {
    if (parentPort) {
      parentPort.postMessage([{
        success: false,
        error: error.message || 'Worker execution failed'
      }])
    }
  }
}

processTasks()

