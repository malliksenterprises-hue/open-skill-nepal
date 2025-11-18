/**
 * Reusable Button component with different variants
 */
export default function Button({ 
  children, 
  variant = 'primary',
  className = '',
  disabled = false,
  ...props 
}) {
  const baseStyles = 'inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variants = {
    primary: 'border-transparent text-white bg-primary-600 hover:bg-primary-700',
    secondary: 'border-transparent text-primary-700 bg-primary-100 hover:bg-primary-200',
    outline: 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
    danger: 'border-transparent text-white bg-red-600 hover:bg-red-700'
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
