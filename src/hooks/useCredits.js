import { useCreditsStore } from '@/stores/creditsStore'

export function useCredits() {
  const { balance, loading } = useCreditsStore()

  return {
    balance,
    loading,
  }
}
