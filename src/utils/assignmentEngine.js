import { CREATIVE_SKILL_LABELS } from '@/utils/creativeSkills'

const ACTIVE_PROJECT_STATUSES = new Set([
  'pending_confirmation',
  'confirmed',
  'in_progress',
  'ready_for_qc',
  'client_review',
  'revision_requested',
])

const EXPERIENCE_WEIGHTS = {
  junior: 0.6,
  mid: 0.8,
  senior: 1,
}

const EXPERIENCE_SKILL_BASELINES = {
  junior: 3.2,
  mid: 4.0,
  senior: 4.6,
}

function normalizeSkills(list = []) {
  if (!Array.isArray(list)) return []
  return [...new Set(list.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))]
}

function normalizeAvailability(value) {
  const status = String(value || 'available').toLowerCase()
  if (['available', 'busy', 'unavailable'].includes(status)) return status
  return 'available'
}

function normalizeExperience(value) {
  const level = String(value || 'mid').toLowerCase()
  if (['junior', 'mid', 'senior'].includes(level)) return level
  return 'mid'
}

function resolveSkillRatingForTag(creative, skillTag, experienceLevel) {
  const normalizedTag = String(skillTag || '').trim().toLowerCase()
  if (!normalizedTag) return EXPERIENCE_SKILL_BASELINES[experienceLevel] || EXPERIENCE_SKILL_BASELINES.mid

  const rawRatings = creative?.skillRatings
  if (rawRatings && typeof rawRatings === 'object' && !Array.isArray(rawRatings)) {
    const direct = Number(rawRatings[normalizedTag])
    if (Number.isFinite(direct) && direct >= 0) return Math.min(5, direct)
  }

  return EXPERIENCE_SKILL_BASELINES[experienceLevel] || EXPERIENCE_SKILL_BASELINES.mid
}

function resolveQuality(creative) {
  const explicit = Number(creative?.qualityRating)
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(5, explicit)
  const perf = Number(creative?.performance?.avgRating)
  if (Number.isFinite(perf) && perf > 0) return Math.min(5, perf)
  return 3.5
}

function resolveMaxActiveProjects(creative) {
  const value = Number(creative?.maxActiveProjects)
  if (Number.isFinite(value) && value > 0) return value
  return 3
}

function resolveCurrentLoad(creative, activeAssignedProjects, maxActiveProjects) {
  const value = Number(creative?.currentLoadScore)
  if (Number.isFinite(value) && value >= 0) return Math.min(100, value)
  return Math.min(100, (activeAssignedProjects / Math.max(1, maxActiveProjects)) * 100)
}

function countActiveProjectsByCreative(projects = []) {
  const map = {}
  projects.forEach((project) => {
    const creativeId = project?.assignedCreativeId
    if (!creativeId) return
    if (!ACTIVE_PROJECT_STATUSES.has(project?.status)) return
    map[creativeId] = (map[creativeId] || 0) + 1
  })
  return map
}

function formatSkillList(skills = []) {
  return skills.map((skill) => CREATIVE_SKILL_LABELS[skill] || skill)
}

export function recommendCreativesForProject({
  project,
  creatives,
  projects,
  maxCandidates = 5,
  loadThreshold = 90,
} = {}) {
  const safeCreatives = Array.isArray(creatives) ? creatives : []
  const safeProjects = Array.isArray(projects) ? projects : []
  const activeProjectsByCreative = countActiveProjectsByCreative(safeProjects)

  const requiredSkills = normalizeSkills(project?.requiredSkills)
  const complexity = String(project?.complexity || 'medium').toLowerCase()

  const candidates = []
  const excluded = []

  safeCreatives.forEach((creative) => {
    const creativeId = creative?.id
    if (!creativeId) return

    const availabilityStatus = normalizeAvailability(creative?.availabilityStatus || creative?.availability)
    const maxActiveProjects = resolveMaxActiveProjects(creative)
    const activeAssignedProjects = Number(activeProjectsByCreative[creativeId] || 0)
    const currentLoadScore = resolveCurrentLoad(creative, activeAssignedProjects, maxActiveProjects)

    if (availabilityStatus === 'unavailable') {
      excluded.push({ creativeId, reason: 'Unavailable' })
      return
    }

    if (activeAssignedProjects >= maxActiveProjects) {
      excluded.push({ creativeId, reason: 'At maximum active projects' })
      return
    }

    if (currentLoadScore >= loadThreshold) {
      excluded.push({ creativeId, reason: 'Load score above threshold' })
      return
    }

    const primarySkills = normalizeSkills(creative?.primarySkills)
    const secondarySkills = normalizeSkills(creative?.secondarySkills)
    const allSkills = normalizeSkills(creative?.skills)
    const skillPool = normalizeSkills([...primarySkills, ...secondarySkills, ...allSkills])

    const matchedSkills = requiredSkills.filter((skill) => skillPool.includes(skill))
    const missingSkills = requiredSkills.filter((skill) => !matchedSkills.includes(skill))

    const experienceLevel = normalizeExperience(creative?.experienceLevel || creative?.tier)
    const matchedSkillRatings = matchedSkills.map((skillTag) =>
      resolveSkillRatingForTag(creative, skillTag, experienceLevel),
    )
    const matchedSkillAverage = matchedSkillRatings.length > 0
      ? matchedSkillRatings.reduce((sum, rating) => sum + rating, 0) / matchedSkillRatings.length
      : (EXPERIENCE_SKILL_BASELINES[experienceLevel] || EXPERIENCE_SKILL_BASELINES.mid)
    const skillMatchRatio = requiredSkills.length > 0 ? matchedSkills.length / requiredSkills.length : 0.5
    const skillCoverageScore = skillMatchRatio * 30
    const skillProficiencyScore = (matchedSkillAverage / 5) * 15
    const skillScore = skillCoverageScore + skillProficiencyScore

    const availabilityScore = availabilityStatus === 'available' ? 15 : 8

    const capacityLeftRatio = Math.max(0, (maxActiveProjects - activeAssignedProjects) / Math.max(1, maxActiveProjects))
    const capacityScore = capacityLeftRatio * 10

    const loadScore = Math.max(0, (1 - (currentLoadScore / 100))) * 15
    const workloadScore = capacityScore + loadScore

    const qualityRating = resolveQuality(creative)
    const qualityScore = (qualityRating / 5) * 15

    const experienceWeight = EXPERIENCE_WEIGHTS[experienceLevel] || EXPERIENCE_WEIGHTS.mid
    let experienceScore = 10 * experienceWeight
    if (complexity === 'high' && experienceLevel === 'senior') experienceScore += 2
    if (complexity === 'high' && experienceLevel === 'junior') experienceScore -= 2

    const assignmentBreakdown = {
      skillMatchScore: Number(skillScore.toFixed(2)),
      workloadScore: Number(workloadScore.toFixed(2)),
      qualityScore: Number(qualityScore.toFixed(2)),
      experienceScore: Number(experienceScore.toFixed(2)),
      availabilityScore: Number(availabilityScore.toFixed(2)),
    }

    const totalScore = Math.max(0, Math.min(
      100,
      assignmentBreakdown.skillMatchScore +
      assignmentBreakdown.workloadScore +
      assignmentBreakdown.qualityScore +
      assignmentBreakdown.experienceScore +
      assignmentBreakdown.availabilityScore,
    ))

    const reasonParts = [
      `${matchedSkills.length}/${requiredSkills.length || 0} required skills matched`,
      availabilityStatus === 'available' ? 'available now' : 'busy but has capacity',
      `load ${currentLoadScore.toFixed(0)}%`,
      `quality ${qualityRating.toFixed(1)}/5`,
      `experience ${experienceLevel}`,
    ]

    candidates.push({
      creativeId,
      creativeName: creative?.displayName || creative?.email || 'Unknown creative',
      score: Number(totalScore.toFixed(2)),
      reason: reasonParts.join(' · '),
      reasonParts,
      assignmentBreakdown,
      matchedSkills,
      matchedSkillLabels: formatSkillList(matchedSkills),
      missingSkills,
      missingSkillLabels: formatSkillList(missingSkills),
      availabilityStatus,
      currentLoadScore: Number(currentLoadScore.toFixed(1)),
      activeAssignedProjects,
      maxActiveProjects,
      qualityRating: Number(qualityRating.toFixed(2)),
      experienceLevel,
      primarySkills,
      secondarySkills,
      assignmentMode: 'recommended',
    })
  })

  candidates.sort((a, b) => b.score - a.score)

  return {
    candidates: candidates.slice(0, Math.max(1, maxCandidates)),
    bestMatch: candidates[0] || null,
    excluded,
  }
}
