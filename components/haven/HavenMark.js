import { cn } from '../../lib/cn'
import ParleLogo from '../brand/ParleLogo'

export default function HavenMark({ expanded }) {
  return (
    <div
      className={cn(
        'haven-mark',
        expanded ? 'haven-mark--expanded' : 'haven-mark--collapsed',
      )}
    >
      {expanded ? (
        <ParleLogo variant="inline" size="sm" className="haven-mark__logo" />
      ) : (
        <ParleLogo variant="icon" size="sm" className="haven-mark__logo-icon" />
      )}
    </div>
  )
}
