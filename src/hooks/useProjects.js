import { useEffect, useState } from 'react'
import projectService from '@/services/projectService'

export function useProjects(clientId) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(Boolean(clientId))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!clientId) {
      return
    }

    const unsubscribe = projectService.subscribeToClientProjects(
      clientId,
      (nextProjects) => {
        setProjects(nextProjects)
        setLoading(false)
      },
      (nextError) => {
        console.error('[useProjects] Failed to subscribe to projects:', nextError)
        setError('Unable to load projects')
        setLoading(false)
      },
    )

    return unsubscribe
  }, [clientId])

  return {
    projects,
    loading,
    error,
  }
}
