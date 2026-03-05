import { useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase.js'

function FirebaseTest() {
  useEffect(() => {
    let isMounted = true

    const testFirestoreConnection = async () => {
      try {
        console.log('[FirebaseTest] Starting Firestore connection test...')

        const testDocRef = doc(db, 'test', 'connectionTest')

        await setDoc(testDocRef, {
          message: 'SanaaDeck Firebase Connected',
          timestamp: new Date(),
        })
        console.log('[FirebaseTest] Write successful')

        const docSnapshot = await getDoc(testDocRef)

        if (!isMounted) return

        if (docSnapshot.exists()) {
          console.log('[FirebaseTest] Read successful:', docSnapshot.data())
        } else {
          console.warn('[FirebaseTest] Document not found after write')
        }
      } catch (error) {
        if (!isMounted) return
        console.error('[FirebaseTest] Firestore connection test failed:', error)
      }
    }

    testFirestoreConnection()

    return () => {
      isMounted = false
    }
  }, [])

  return null
}

export default FirebaseTest
