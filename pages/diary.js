import { useEffect } from 'react'
import { useRouter } from 'next/router'

/** Legacy route — redirects to /journal */
export default function DiaryRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/journal')
  }, [router])
  return null
}
