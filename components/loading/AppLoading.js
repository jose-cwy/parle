import LoadingShell from './LoadingShell'

export default function AppLoading({ message, messageSeed, className = '', fullPage = true }) {
  return (
    <LoadingShell message={message} messageSeed={messageSeed} fullPage={fullPage} className={className}>
      <div className="hs-loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </LoadingShell>
  )
}
