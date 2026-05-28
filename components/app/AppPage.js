/**
 * Consistent logged-in page layout wrapper.
 */
export function AppPageHeader({ eyebrow, title, description, action, className = '' }) {
  return (
    <header className={`hs-app-header ${className}`.trim()}>
      <div className="hs-app-header__main">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {title ? <h1 className="hs-app-header__title">{title}</h1> : null}
        {description ? <p className="hs-app-header__desc">{description}</p> : null}
      </div>
      {action ? <div className="hs-app-header__action">{action}</div> : null}
    </header>
  )
}

export default function AppPage({ children, className = '', width = 'default' }) {
  const widthClass = width === 'default' ? '' : `hs-app-page--${width}`
  return (
    <div className={`hs-app-page ${widthClass} ${className}`.trim()}>
      {children}
    </div>
  )
}
