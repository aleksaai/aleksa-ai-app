import { useParams } from 'react-router-dom'
import { Dashboard } from './Dashboard'

export function CustomerPreview() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <div>Missing customer id</div>
  return <Dashboard customerIdOverride={id} isAdminPreview />
}
