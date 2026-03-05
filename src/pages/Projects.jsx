import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import ProjectCard from '@/components/projects/ProjectCard'

function Projects() {
  const { userProfile } = useAuth()
  const clientId = userProfile?.role === 'client' ? userProfile?.uid : null
  const { projects, loading, error } = useProjects(clientId)

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <p className="mb-4 text-sm text-muted-foreground">Client project list view.</p>

      {loading ? <p className="text-sm text-muted-foreground">Loading projects...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </main>
  )
}

export default Projects
