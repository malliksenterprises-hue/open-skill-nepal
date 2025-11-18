/**
 * Reusable Card component for dashboard items
 */
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white overflow-hidden shadow rounded-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Card header component
 */
export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-4 py-5 sm:px-6 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Card content component
 */
export function CardContent({ children, className = '' }) {
  return (
    <div className={`px-4 py-5 sm:p-6 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Card footer component
 */
export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-4 py-4 sm:px-6 bg-gray-50 ${className}`}>
      {children}
    </div>
  )
}
