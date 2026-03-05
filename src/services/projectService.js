import {
  Timestamp,
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import creditService from './creditService'
import fileService from './fileService'

function normalizeTimestamp(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
}

function mapProject(docSnap) {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  }
}

function mapDocs(snapshot) {
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

function sortProjectsByCreatedAt(projects) {
  return projects.sort((a, b) => normalizeTimestamp(b.createdAt) - normalizeTimestamp(a.createdAt))
}

function parseDeadline(deadline) {
  if (!deadline) return null
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return null
  return Timestamp.fromDate(date)
}

function makeActivity(type, message, actor = {}) {
  return {
    type,
    message,
    actorId: actor.uid || 'system',
    actorRole: actor.role || 'system',
    actorDisplayName: actor.displayName || null,
    actorEmail: actor.email || null,
    createdAt: serverTimestamp(),
  }
}

async function createNotification({
  recipientId,
  projectId,
  title,
  message,
  type = 'project_update',
  channels = { inApp: true, email: true, sms: false },
  relatedIds = {},
}) {
  if (!recipientId) return

  const notificationRef = doc(collection(db, 'notifications'))
  await setDoc(notificationRef, {
    recipientId,
    projectId: projectId || null,
    relatedIds,
    type,
    channels: {
      inApp: channels.inApp !== false,
      email: Boolean(channels.email),
      sms: Boolean(channels.sms),
    },
    title,
    message,
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

function memberRef(projectId, uid) {
  return doc(db, 'projects', projectId, 'members', uid)
}

function workspaceCollectionRef(projectId, collectionName) {
  return collection(db, 'projects', projectId, collectionName)
}

function presenceRef(projectId, uid) {
  return doc(db, 'projects', projectId, 'presence', uid)
}

function workspaceQuery(projectId, collectionName, pageSize, cursor = null) {
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))
  return query(workspaceCollectionRef(projectId, collectionName), ...constraints)
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

class ProjectService {
  async finalizeProjectReferenceFiles(projectId, clientId, referenceFiles = []) {
    if (!projectId || !clientId || !Array.isArray(referenceFiles) || referenceFiles.length === 0) {
      return Array.isArray(referenceFiles) ? referenceFiles : []
    }

    const targetPath = `clients/${clientId}/projects/${projectId}/brief`
    const finalized = await Promise.all(referenceFiles.map(async (entry) => {
      if (!entry || typeof entry === 'string') return entry
      if (entry.source !== 'storage') return entry
      try {
        return await fileService.relocateStorageFile(entry, targetPath)
      } catch (error) {
        console.error('[ProjectService] Failed to relocate reference file:', error)
        return entry
      }
    }))
    return finalized
  }

  subscribeToClientProjects(clientId, onData, onError) {
    const projectsQuery = query(collection(db, 'projects'), where('clientId', '==', clientId))

    return onSnapshot(
      projectsQuery,
      (snapshot) => {
        onData(sortProjectsByCreatedAt(snapshot.docs.map(mapProject)))
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  subscribeToCreativeProjects(creativeId, onData, onError) {
    const projectsQuery = query(collection(db, 'projects'), where('assignedCreativeId', '==', creativeId))

    return onSnapshot(
      projectsQuery,
      (snapshot) => {
        onData(sortProjectsByCreatedAt(snapshot.docs.map(mapProject)))
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  subscribeToWorkspaceCollection(projectId, collectionName, pageSize, onData, onError) {
    if (!projectId) return () => {}

    const q = workspaceQuery(projectId, collectionName, pageSize)
    return onSnapshot(
      q,
      (snapshot) => {
        const items = mapDocs(snapshot)
        const cursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
        onData({ items, cursor, hasMore: snapshot.docs.length >= pageSize })
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  async fetchWorkspaceCollectionPage(projectId, collectionName, pageSize, cursor = null) {
    if (!projectId) return { items: [], cursor: null, hasMore: false }
    const snapshot = await getDocs(workspaceQuery(projectId, collectionName, pageSize, cursor))
    const items = mapDocs(snapshot)
    const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
    return { items, cursor: nextCursor, hasMore: snapshot.docs.length >= pageSize }
  }

  async backfillWorkspaceDataForProject(project, actor = { role: 'system' }) {
    if (!project?.id) return
    if (project.workspaceDataMigratedAt) return

    const projectId = project.id
    const legacyNotes = Array.isArray(project.workspaceNotesLog) ? project.workspaceNotesLog : []
    const legacyComments = Array.isArray(project.comments) ? project.comments : []
    const legacyVersions = Array.isArray(project.deliverableLinks) ? project.deliverableLinks : []
    const legacyActivities = Array.isArray(project.activityFeed) ? project.activityFeed : []

    if (legacyNotes.length + legacyComments.length + legacyVersions.length + legacyActivities.length === 0) {
      return
    }

    const [noteProbe, commentProbe, versionProbe, activityProbe] = await Promise.all([
      getDocs(query(workspaceCollectionRef(projectId, 'notes'), limit(1))),
      getDocs(query(workspaceCollectionRef(projectId, 'comments'), limit(1))),
      getDocs(query(workspaceCollectionRef(projectId, 'versions'), limit(1))),
      getDocs(query(workspaceCollectionRef(projectId, 'activities'), limit(1))),
    ])

    if (!noteProbe.empty || !commentProbe.empty || !versionProbe.empty || !activityProbe.empty) {
      await updateDoc(doc(db, 'projects', projectId), {
        workspaceDataMigratedAt: serverTimestamp(),
        workspaceDataMigrationVersion: 1,
      })
      return
    }

    const tasks = []
    legacyNotes.forEach((entry, index) => {
      tasks.push(
        setDoc(doc(workspaceCollectionRef(projectId, 'notes'), entry.id || `legacy_note_${index + 1}`), {
          content: entry.content || '',
          authorId: entry.authorId || 'unknown',
          authorRole: entry.authorRole || 'unknown',
          createdAt: entry.createdAt || serverTimestamp(),
          migratedFromLegacy: true,
        }, { merge: true }),
      )
    })

    legacyComments.forEach((entry, index) => {
      tasks.push(
        setDoc(doc(workspaceCollectionRef(projectId, 'comments'), entry.id || `legacy_comment_${index + 1}`), {
          content: entry.content || '',
          authorId: entry.authorId || 'unknown',
          authorRole: entry.authorRole || 'unknown',
          parentId: entry.parentId || null,
          status: entry.status || 'needs_attention',
          mentions: Array.isArray(entry.mentions) ? entry.mentions : [],
          createdAt: entry.createdAt || serverTimestamp(),
          updatedAt: entry.updatedAt || null,
          migratedFromLegacy: true,
        }, { merge: true }),
      )
    })

    legacyVersions.forEach((entry, index) => {
      const normalized = typeof entry === 'string'
        ? { url: entry, version: `v${index + 1}`, versionNumber: index + 1, note: null }
        : {
          url: entry.url || '',
          version: entry.version || `v${index + 1}`,
          versionNumber: Number(entry.versionNumber || String(entry.version || '').replace(/\D+/g, '') || index + 1),
          note: entry.note || null,
        }
      if (!normalized.url) return
      tasks.push(
        setDoc(doc(workspaceCollectionRef(projectId, 'versions'), entry.id || `legacy_version_${index + 1}`), {
          ...normalized,
          createdBy: entry.createdBy || 'migration',
          createdByRole: entry.createdByRole || 'system',
          createdAt: entry.createdAt || serverTimestamp(),
          migratedFromLegacy: true,
        }, { merge: true }),
      )
    })

    legacyActivities.forEach((entry, index) => {
      tasks.push(
        setDoc(doc(workspaceCollectionRef(projectId, 'activities'), entry.id || `legacy_activity_${index + 1}`), {
          type: entry.type || 'legacy_activity',
          message: entry.message || 'Legacy activity',
          actorId: entry.actorId || actor.uid || 'system',
          actorRole: entry.actorRole || actor.role || 'system',
          createdAt: entry.createdAt || serverTimestamp(),
          migratedFromLegacy: true,
        }, { merge: true }),
      )
    })

    await Promise.all(tasks)
    await updateDoc(doc(db, 'projects', projectId), {
      workspaceDataMigratedAt: serverTimestamp(),
      workspaceDataMigrationVersion: 1,
      updatedAt: serverTimestamp(),
    })
  }

  async addProjectActivity(projectId, type, message, actor = {}) {
    if (!projectId) return
    await addDoc(workspaceCollectionRef(projectId, 'activities'), makeActivity(type, message, actor))
  }

  async createProjectWithCreditReservation({
    clientId,
    createdBy,
    title,
    deliverableType,
    complexity = 'standard',
    description = '',
    brief = '',
    referenceFiles = [],
    deadline = '',
  }) {
    if (!clientId) throw new Error('clientId is required')
    if (!title?.trim()) throw new Error('Project title is required')
    if (!deliverableType) throw new Error('Deliverable type is required')

    const estimatedCredits = creditService.estimateCredits(deliverableType, complexity)
    const creditBalance = await creditService.getCreditBalance(clientId)
    if (Number(creditBalance.totalCredits || 0) < estimatedCredits) {
      throw new Error('Insufficient credits to create this project.')
    }

    const projectRef = doc(collection(db, 'projects'))

    const projectPayload = {
      clientId,
      createdBy: createdBy || clientId,
      title: title.trim(),
      deliverableType,
      complexity,
      description: description.trim(),
      brief: brief.trim(),
      estimatedCredits,
      confirmedCredits: null,
      actualCreditsUsed: null,
      creditsReserved: false,
      reservedCreditsAmount: 0,
      status: 'pending_confirmation',
      assignedCreativeId: null,
      assignedCreativeIds: [],
      workspaceNotes: '',
      referenceFiles: Array.isArray(referenceFiles) ? referenceFiles : [],
      clientRating: null,
      ratingsHistory: [],
      deadline: parseDeadline(deadline),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    await setDoc(projectRef, projectPayload)

    if (Array.isArray(referenceFiles) && referenceFiles.length > 0) {
      const finalizedReferenceFiles = await this.finalizeProjectReferenceFiles(projectRef.id, clientId, referenceFiles)
      await updateDoc(projectRef, {
        referenceFiles: finalizedReferenceFiles,
        updatedAt: serverTimestamp(),
      })
    }

    await this.upsertProjectMember(projectRef.id, clientId, 'client_owner', { addedBy: createdBy || clientId })
    await this.addProjectActivity(projectRef.id, 'project_created', 'Project request submitted and awaiting admin confirmation', { uid: createdBy || clientId, role: 'client' })

    await createNotification({
      recipientId: clientId,
      projectId: projectRef.id,
      title: 'Project request submitted',
      message: `${title.trim()} is pending admin confirmation before creative assignment.`,
    })

    return {
      projectId: projectRef.id,
      estimatedCredits,
    }
  }

  async upsertProjectMember(projectId, uid, role, metadata = {}) {
    if (!projectId || !uid || !role) return

    await setDoc(
      memberRef(projectId, uid),
      {
        uid,
        role,
        status: metadata.status || 'active',
        displayName: metadata.displayName || null,
        email: metadata.email || null,
        addedBy: metadata.addedBy || uid,
        addedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  subscribeToProjectMembers(projectId, onData, onError) {
    if (!projectId) return () => {}

    return onSnapshot(
      collection(db, 'projects', projectId, 'members'),
      (snapshot) => {
        onData(mapDocs(snapshot))
      },
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  subscribeToWorkspacePresence(projectId, onData, onError) {
    if (!projectId) return () => {}
    return onSnapshot(
      collection(db, 'projects', projectId, 'presence'),
      (snapshot) => onData(mapDocs(snapshot)),
      (error) => {
        if (onError) onError(error)
      },
    )
  }

  async upsertWorkspacePresence(projectId, { uid, role, displayName, email, activeTab = 'overview' }) {
    if (!projectId || !uid) return
    await setDoc(presenceRef(projectId, uid), {
      uid,
      role: role || 'unknown',
      displayName: displayName || null,
      email: email || null,
      activeTab,
      status: 'online',
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    }, { merge: true })
  }

  async clearWorkspacePresence(projectId, uid) {
    if (!projectId || !uid) return
    await setDoc(presenceRef(projectId, uid), {
      status: 'offline',
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    }, { merge: true })
  }

  async markWorkspaceTabRead(projectId, uid, tabKey) {
    if (!projectId || !uid || !tabKey) return
    await setDoc(memberRef(projectId, uid), {
      uid,
      updatedAt: serverTimestamp(),
      lastReadAtByTab: {
        [tabKey]: Timestamp.now(),
      },
    }, { merge: true })
  }

  async resolveUserByEmail(email) {
    const normalized = normalizeEmail(email)
    if (!normalized) throw new Error('Email is required')

    const usersQuery = query(collection(db, 'users'), where('email', '==', normalized), limit(1))
    const usersSnapshot = await getDocs(usersQuery)
    if (usersSnapshot.empty) {
      throw new Error('No user found with this email')
    }

    const userDoc = usersSnapshot.docs[0]
    return { uid: userDoc.id, ...userDoc.data() }
  }

  async addProjectMemberByEmail(projectId, { email, role = 'project_collaborator', status = 'active' }, actor = {}) {
    if (!projectId) throw new Error('projectId is required')

    const user = await this.resolveUserByEmail(email)
    const resolvedRole = String(role || '').trim() || 'project_collaborator'

    await this.upsertProjectMember(projectId, user.uid, resolvedRole, {
      status,
      displayName: user.displayName || null,
      email: user.email || normalizeEmail(email),
      addedBy: actor.uid || 'system',
    })

    await this.addProjectActivity(projectId, 'member_added', `Added ${user.email || user.uid} as ${resolvedRole}`, actor)
    await createNotification({
      recipientId: user.uid,
      projectId,
      title: 'You were added to a project workspace',
      message: `You now have ${resolvedRole} access in a project workspace.`,
    })

    return user
  }

  async updateProjectMemberStatus(projectId, memberUid, status = 'active', actor = {}) {
    if (!projectId || !memberUid) throw new Error('projectId and memberUid are required')
    if (!['active', 'inactive'].includes(status)) throw new Error('Invalid member status')

    await updateDoc(memberRef(projectId, memberUid), {
      status,
      updatedAt: serverTimestamp(),
    })

    await this.addProjectActivity(projectId, 'member_status_updated', `Member ${memberUid} set to ${status}`, actor)
  }

  async updateProjectMemberRole(projectId, memberUid, role, actor = {}) {
    if (!projectId || !memberUid || !role) throw new Error('projectId, memberUid and role are required')

    const allowedRoles = ['project_admin', 'app_admin', 'project_collaborator', 'creative_lead']
    if (!allowedRoles.includes(role)) throw new Error('Invalid member role')

    await updateDoc(memberRef(projectId, memberUid), {
      role,
      updatedAt: serverTimestamp(),
    })

    await this.addProjectActivity(projectId, 'member_role_updated', `Member ${memberUid} role changed to ${role}`, actor)
    await createNotification({
      recipientId: memberUid,
      projectId,
      title: 'Workspace role updated',
      message: `Your project workspace role is now ${role}.`,
    })
  }

  async removeProjectMember(projectId, memberUid, actor = {}) {
    if (!projectId || !memberUid) throw new Error('projectId and memberUid are required')

    const projectSnap = await getDoc(doc(db, 'projects', projectId))
    if (!projectSnap.exists()) throw new Error('Project not found')
    const projectData = projectSnap.data() || {}
    if (projectData.clientId === memberUid) {
      throw new Error('Project owner cannot be removed. Transfer ownership first.')
    }

    const memberSnap = await getDoc(memberRef(projectId, memberUid))
    if (!memberSnap.exists()) return
    const memberData = memberSnap.data() || {}
    if (memberData.role === 'client_owner') {
      throw new Error('Client owner cannot be removed from project workspace')
    }

    if (memberData.role === 'project_admin' || memberData.role === 'app_admin') {
      const membersSnap = await getDocs(collection(db, 'projects', projectId, 'members'))
      const activeAdminCount = membersSnap.docs
        .map((entry) => entry.data() || {})
        .filter((entry) => ['project_admin', 'app_admin'].includes(entry.role) && (entry.status || 'active') === 'active')
        .length
      if (activeAdminCount <= 1) {
        throw new Error('At least one active project/app admin must remain in workspace')
      }
    }

    await deleteDoc(memberRef(projectId, memberUid))
    await this.clearWorkspacePresence(projectId, memberUid)

    await this.addProjectActivity(projectId, 'member_removed', `Member ${memberUid} removed from workspace`, actor)
    await createNotification({
      recipientId: memberUid,
      projectId,
      title: 'Removed from project workspace',
      message: 'Your access to this project workspace has been removed.',
    })
  }

  async transferProjectOwnership(projectId, newOwnerUid, actor = {}) {
    if (!projectId || !newOwnerUid) throw new Error('projectId and newOwnerUid are required')

    const projectRef = doc(db, 'projects', projectId)
    const newOwnerMemberRef = memberRef(projectId, newOwnerUid)

    const previousOwnerUid = await runTransaction(db, async (tx) => {
      const projectSnap = await tx.get(projectRef)
      if (!projectSnap.exists()) throw new Error('Project not found')

      const projectData = projectSnap.data() || {}
      const currentOwnerUid = projectData.clientId
      if (!currentOwnerUid) throw new Error('Current project owner missing')
      if (currentOwnerUid === newOwnerUid) throw new Error('Selected user already owns this project')

      const newOwnerMemberSnap = await tx.get(newOwnerMemberRef)
      if (!newOwnerMemberSnap.exists()) {
        throw new Error('New owner must be added as project member first')
      }

      tx.update(projectRef, {
        clientId: newOwnerUid,
        updatedAt: serverTimestamp(),
      })

      tx.set(newOwnerMemberRef, {
        uid: newOwnerUid,
        role: 'client_owner',
        status: 'active',
        updatedAt: serverTimestamp(),
      }, { merge: true })

      tx.set(memberRef(projectId, currentOwnerUid), {
        uid: currentOwnerUid,
        role: 'project_collaborator',
        status: 'active',
        updatedAt: serverTimestamp(),
      }, { merge: true })

      return currentOwnerUid
    })

    await this.addProjectActivity(projectId, 'ownership_transferred', `Project ownership transferred to ${newOwnerUid}`, actor)

    await createNotification({
      recipientId: newOwnerUid,
      projectId,
      title: 'Project ownership assigned',
      message: 'You are now the client owner for this project workspace.',
    })

    if (previousOwnerUid && previousOwnerUid !== newOwnerUid) {
      await createNotification({
        recipientId: previousOwnerUid,
        projectId,
        title: 'Project ownership transferred',
        message: 'You are no longer the client owner for this project workspace.',
      })
    }
  }

  async startProject(projectId, actor = { role: 'creative' }) {
    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data()

    await updateDoc(projectRef, {
      status: 'in_progress',
      updatedAt: serverTimestamp(),
    })
    await this.addProjectActivity(projectId, 'project_started', 'Project started by creative', actor)

    if (actor?.uid) {
      await this.upsertProjectMember(projectId, actor.uid, actor.role || 'creative_lead', { addedBy: actor.uid })
    }

    await createNotification({
      recipientId: data.clientId,
      projectId,
      title: 'Project in progress',
      message: `${data.title} is now in progress.`,
    })
  }

  async updateProjectWorkspace(projectId, { actualCreditsUsed, workspaceNotes, trackedMinutes, workspaceNoteEntry }, actor = { role: 'creative' }) {
    const projectRef = doc(db, 'projects', projectId)

    await runTransaction(db, async (tx) => {
      const projectSnap = await tx.get(projectRef)
      if (!projectSnap.exists()) throw new Error('Project not found')

      const data = projectSnap.data()
      const payload = { updatedAt: serverTimestamp() }

      if (Number.isFinite(actualCreditsUsed)) {
        payload.actualCreditsUsed = actualCreditsUsed
      }

      if (typeof workspaceNotes === 'string') {
        payload.workspaceNotes = workspaceNotes.trim()
      }

      if (Number.isFinite(trackedMinutes) && trackedMinutes > 0) {
        const nextTotal = Number(data.totalTrackedMinutes || 0) + Number(trackedMinutes)
        payload.timeTrackingEntries = arrayUnion({
          minutes: trackedMinutes,
          createdAt: Timestamp.now(),
          actorId: actor.uid || 'unknown',
        })
        payload.totalTrackedMinutes = nextTotal
      }

      tx.update(projectRef, payload)

      const noteContent = typeof workspaceNoteEntry?.content === 'string' ? workspaceNoteEntry.content.trim() : ''
      if (noteContent) {
        const noteRef = doc(workspaceCollectionRef(projectId, 'notes'))
        tx.set(noteRef, {
          content: noteContent,
          authorId: workspaceNoteEntry.authorId || actor.uid || 'unknown',
          authorRole: workspaceNoteEntry.authorRole || actor.role || 'unknown',
          authorDisplayName: workspaceNoteEntry.authorDisplayName || actor.displayName || null,
          authorEmail: workspaceNoteEntry.authorEmail || actor.email || null,
          createdAt: Timestamp.now(),
        })
      }
    })

    await this.addProjectActivity(projectId, 'workspace_updated', 'Workspace notes or time tracking updated', actor)
  }

  async submitProjectForQC(projectId, { actualCreditsUsed, workspaceNotes }, actor = { role: 'creative' }) {
    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data()

    const payload = {
      status: 'ready_for_qc',
      updatedAt: serverTimestamp(),
    }

    if (Number.isFinite(actualCreditsUsed)) {
      payload.actualCreditsUsed = actualCreditsUsed
    }

    if (typeof workspaceNotes === 'string') {
      payload.workspaceNotes = workspaceNotes.trim()
    }

    await updateDoc(projectRef, payload)
    await this.addProjectActivity(projectId, 'submitted_qc', 'Project submitted for QC', actor)

    if (actor?.uid) {
      await this.upsertProjectMember(projectId, actor.uid, actor.role || 'creative_lead', { addedBy: actor.uid })
    }

    await createNotification({
      recipientId: data.clientId,
      projectId,
      title: 'Project submitted for QC',
      message: `${data.title} is submitted and waiting for project admin QC.`,
    })

    await createNotification({
      recipientId: data.assignedCreativeId,
      projectId,
      title: 'QC submitted',
      message: `${data.title} was submitted to QC.`,
    })
  }

  async addDeliverableLink(projectId, deliverableLink, noteOrOptions = '', actor = { role: 'creative' }) {
    const link = deliverableLink?.trim()
    if (!link) return

    const options = typeof noteOrOptions === 'object' && noteOrOptions !== null
      ? noteOrOptions
      : { note: String(noteOrOptions || '').trim() }
    const note = String(options.note || '').trim()
    const revisionRound = Number(options.revisionRound || 1)
    const isLatest = options.isLatest !== false
    const files = Array.isArray(options.files) ? options.files : []
    const requestedTarget = String(options.targetFolder || 'revisions').toLowerCase()
    const targetFolder = ['wip', 'revisions', 'final'].includes(requestedTarget) ? requestedTarget : 'revisions'

    const latestVersionQuery = query(workspaceCollectionRef(projectId, 'versions'), orderBy('versionNumber', 'desc'), limit(1))
    const latestVersionSnap = await getDocs(latestVersionQuery)
    const latestVersion = latestVersionSnap.docs[0]?.data()?.versionNumber || 0
    const nextVersion = Number(latestVersion) + 1

    if (isLatest) {
      const currentLatestQuery = query(workspaceCollectionRef(projectId, 'versions'), where('isLatest', '==', true))
      const currentLatestSnap = await getDocs(currentLatestQuery)
      await Promise.all(currentLatestSnap.docs.map((entry) => updateDoc(entry.ref, { isLatest: false, updatedAt: serverTimestamp() })))
    }

    await addDoc(workspaceCollectionRef(projectId, 'versions'), {
      url: link,
      note: note || null,
      version: `v${nextVersion}`,
      versionNumber: nextVersion,
      revisionRound: Number.isFinite(revisionRound) ? revisionRound : 1,
      isLatest,
      files,
      targetFolder,
      createdBy: actor.uid || 'unknown',
      createdByRole: actor.role || 'creative',
      createdAt: serverTimestamp(),
    })

    await updateDoc(doc(db, 'projects', projectId), {
      updatedAt: serverTimestamp(),
    })

    await this.addProjectActivity(projectId, 'deliverable_uploaded', `Uploaded deliverable version v${nextVersion} to ${targetFolder}`, actor)
  }

  async addProjectComment(projectId, comment) {
    const content = comment?.content?.trim()
    if (!content) return

    const mentions = (content.match(/@[a-zA-Z0-9_]+/g) || []).map((value) => value.slice(1).toLowerCase())
    await addDoc(workspaceCollectionRef(projectId, 'comments'), {
      content,
      authorId: comment.authorId || 'unknown',
      authorRole: comment.authorRole || 'creative',
      authorDisplayName: comment.authorDisplayName || null,
      authorEmail: comment.authorEmail || null,
      parentId: comment.parentId || null,
      noteId: comment.noteId || null,
      status: comment.status || 'needs_attention',
      mentions,
      createdAt: serverTimestamp(),
    })

    await updateDoc(doc(db, 'projects', projectId), {
      updatedAt: serverTimestamp(),
    })

    await this.addProjectActivity(projectId, 'comment_added', 'New comment added in workspace', comment)
  }

  async updateCommentStatus(projectId, commentId, status, actor = { role: 'creative' }) {
    const allowed = ['resolved', 'needs_attention', 'approved']
    if (!allowed.includes(status)) {
      throw new Error('Invalid comment status')
    }

    await updateDoc(doc(db, 'projects', projectId, 'comments', commentId), {
      status,
      updatedAt: serverTimestamp(),
    })

    await updateDoc(doc(db, 'projects', projectId), {
      updatedAt: serverTimestamp(),
    })

    await this.addProjectActivity(projectId, 'comment_status', `Comment marked ${status}`, actor)
  }

  async markProjectForClientReview(projectId, actor = { role: 'project_admin' }) {
    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data()

    await updateDoc(projectRef, {
      status: 'client_review',
      updatedAt: serverTimestamp(),
    })
    await this.addProjectActivity(projectId, 'client_review', 'Project approved for client review', actor)

    if (actor?.uid) {
      await this.upsertProjectMember(projectId, actor.uid, actor.role || 'project_admin', { addedBy: actor.uid })
    }

    await createNotification({
      recipientId: data.clientId,
      projectId,
      title: 'Ready for your review',
      message: `${data.title} passed QC and is ready for your review.`,
    })
  }

  async requestProjectRevision(projectId, requestedBy = 'client', actor = { role: requestedBy }) {
    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data()

    await updateDoc(projectRef, {
      status: 'revision_requested',
      revisionRequestedBy: requestedBy,
      updatedAt: serverTimestamp(),
    })
    await this.addProjectActivity(projectId, 'revision_requested', `Revision requested by ${requestedBy}`, actor)

    if (actor?.uid) {
      await this.upsertProjectMember(projectId, actor.uid, actor.role || requestedBy, { addedBy: actor.uid })
    }

    await createNotification({
      recipientId: data.assignedCreativeId,
      projectId,
      title: 'Revision requested',
      message: `${data.title} needs revisions.`,
    })
  }

  async approveProject(projectId, approvedBy = 'client', actor = { role: approvedBy }) {
    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data()

    let hasReservedCredits = Boolean(data.creditsReserved)
    if (!hasReservedCredits) {
      const priorTxSnap = await getDocs(query(collection(db, 'creditTransactions'), where('projectId', '==', projectId), limit(20)))
      hasReservedCredits = priorTxSnap.docs.some((entry) => entry.data()?.type === 'deduction')
    }

    if (!hasReservedCredits) {
      const creditsToReserve = Number(data.actualCreditsUsed || data.confirmedCredits || data.estimatedCredits || 0)
      if (!Number.isFinite(creditsToReserve) || creditsToReserve <= 0) {
        throw new Error('Unable to reserve credits for project approval.')
      }

      await creditService.reserveCredits(data.clientId, projectId, creditsToReserve)
      await updateDoc(projectRef, {
        creditsReserved: true,
        reservedCreditsAmount: creditsToReserve,
        reservedCreditsAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else if (!data.creditsReserved) {
      // Backfill marker for legacy projects that already had credits deducted earlier.
      await updateDoc(projectRef, {
        creditsReserved: true,
        reservedCreditsAmount: Number(data.reservedCreditsAmount || data.confirmedCredits || data.estimatedCredits || 0),
        updatedAt: serverTimestamp(),
      })
    }

    await updateDoc(projectRef, {
      status: 'approved',
      approvedBy,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await this.addProjectActivity(projectId, 'project_approved', `Project approved by ${approvedBy}`, actor)

    if (actor?.uid) {
      await this.upsertProjectMember(projectId, actor.uid, actor.role || approvedBy, { addedBy: actor.uid })
    }

    await createNotification({
      recipientId: data.assignedCreativeId,
      projectId,
      title: 'Project approved',
      message: `${data.title} has been approved.`,
    })
  }

  async submitClientCreativeRating(projectId, { rating, feedback = '' }, actor = { role: 'client' }) {
    const score = Number(rating)
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

    const projectRef = doc(db, 'projects', projectId)
    const snap = await getDoc(projectRef)
    if (!snap.exists()) throw new Error('Project not found')
    const data = snap.data()

    if (data.status !== 'approved') {
      throw new Error('Project must be approved before rating')
    }

    const ratingEntry = {
      id: `rating_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      rating: score,
      feedback: String(feedback || '').trim(),
      ratedBy: actor.uid || 'client',
      ratedByRole: actor.role || 'client',
      createdAt: Timestamp.now(),
    }

    await updateDoc(projectRef, {
      clientRating: ratingEntry,
      ratingsHistory: arrayUnion(ratingEntry),
      updatedAt: serverTimestamp(),
    })
    await this.addProjectActivity(projectId, 'client_rating', `Client rated creative ${score}/5`, actor)

    await createNotification({
      recipientId: data.assignedCreativeId,
      projectId,
      title: 'New client rating received',
      message: `${data.title} received a ${score}/5 rating.`,
    })
  }
}

export default new ProjectService()
