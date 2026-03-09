import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { SUBSCRIPTION_TIERS, TIER_BY_KEY, USER_ROLES } from '@/utils/constants'

function sanitizeUser(user) {
  if (!user) return null

  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
  }
}

function addDays(days) {
  return Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000))
}

function resolveProfileCollection(role) {
  if (role === USER_ROLES.CLIENT) return 'clients'
  if (role === USER_ROLES.CREATIVE) return 'creatives'
  return null
}

class AuthService {
  async signUp(email, password, userData) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    const role = userData.role === USER_ROLES.CREATIVE ? USER_ROLES.CREATIVE : USER_ROLES.CLIENT
    const userRef = doc(db, 'users', user.uid)

    try {
      const batch = writeBatch(db)

      batch.set(userRef, {
        uid: user.uid,
        email,
        phone: userData.phone || null,
        role,
        displayName: userData.displayName,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        status: 'active',
        emailVerified: user.emailVerified,
        phoneVerified: false,
        profileRef: user.uid,
      })

      if (role === USER_ROLES.CLIENT) {
        this.createClientProfile(user.uid, userData, batch)
      } else {
        this.createCreativeProfile(user.uid, userData, batch)
      }

      await batch.commit()

      const userProfile = await this.getUserProfile(user.uid)
      return { user: sanitizeUser(user), userProfile }
    } catch (error) {
      await deleteUser(user).catch(() => {})
      throw error
    }
  }

  async signIn(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    await updateDoc(doc(db, 'users', user.uid), {
      lastLoginAt: serverTimestamp(),
      emailVerified: user.emailVerified,
    }).catch(() => {})

    const userProfile = await this.getUserProfile(user.uid)
    return { user: sanitizeUser(user), userProfile }
  }

  async signOut() {
    await firebaseSignOut(auth)
  }

  async getUserProfile(uid) {
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      throw new Error('User profile not found')
    }

    const userData = userSnap.data()
    const profileCollection = resolveProfileCollection(userData.role)
    const profileSnap = profileCollection
      ? await getDoc(doc(db, profileCollection, uid))
      : null

    return {
      ...userData,
      profile: profileSnap?.exists?.() ? profileSnap.data() : null,
    }
  }

  createClientProfile(userId, data, batch = null) {
    const clientRef = doc(db, 'clients', userId)
    const selectedTier = TIER_BY_KEY[data.subscriptionTier] || SUBSCRIPTION_TIERS.STARTER

    const clientData = {
      userId,
      businessName: data.businessName || data.displayName || 'New Business',
      industry: data.industry || 'other',
      country: data.country || 'KE',
      city: data.city || '',
      website: data.website || null,
      subscription: {
        tier: selectedTier.key,
        status: 'active',
        startDate: serverTimestamp(),
        currentPeriodStart: serverTimestamp(),
        currentPeriodEnd: addDays(30),
        renewalDate: addDays(30),
        autoRenew: true,
        commitmentEndDate: addDays(180),
        creditsPerMonth: selectedTier.creditsPerMonth,
        creditsUsed: 0,
        creditsRemaining: selectedTier.creditsPerMonth,
      },
      extraCredits: [],
      paymentMethod: null,
      phoneNumber: data.phone || null,
      stats: {
        totalProjects: 0,
        completedProjects: 0,
        activeProjects: 0,
        totalCreditsConsumed: 0,
      },
      brandAssets: {
        logos: [],
        colors: [],
        fonts: [],
        guidelines: null,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    if (batch) {
      batch.set(clientRef, clientData)
      return
    }

    return setDoc(clientRef, clientData)
  }

  createCreativeProfile(userId, data, batch = null) {
    const creativeRef = doc(db, 'creatives', userId)

    const creativeData = {
      userId,
      displayName: data.displayName,
      specialty: data.specialty || 'graphic_design',
      tier: 'mid',
      payoutRate: 9,
      performance: {
        cpsScore: 75,
        avgRating: 4.5,
        onTimeRate: 95,
        revisionRate: 25,
        missedDeadlines: 0,
        status: 'good',
        lastCalculatedAt: null,
      },
      earnings: {
        thisMonth: 0,
        lastMonth: 0,
        lifetime: 0,
        pendingPayout: 0,
        lastPayoutAt: null,
      },
      bonuses: {
        fiveStar: false,
        fastTrack: false,
        volume: false,
        consistency: false,
      },
      skills: [],
      primarySkills: [],
      secondarySkills: [],
      skillRatings: {},
      experienceLevel: 'mid',
      availabilityStatus: 'available',
      maxActiveProjects: 3,
      currentLoadScore: 0,
      qualityRating: 0,
      availability: 'available',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    if (batch) {
      batch.set(creativeRef, creativeData)
      return
    }

    return setDoc(creativeRef, creativeData)
  }
}

export default new AuthService()
