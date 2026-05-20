import React from 'react';

const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-lavender-600 text-white hover:bg-lavender-700 focus:ring-lavender-500',
    secondary: 'bg-lavender-100 text-lavender-600 hover:bg-lavender-200 focus:ring-lavender-400',
    outline: 'border-2 border-lavender-200 text-text-700 hover:border-lavender-400 hover:bg-lavender-50 focus:ring-lavender-300',
    ghost: 'text-lavender-600 hover:bg-lavender-50 focus:ring-lavender-300',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg font-semibold',
  };

  // Internal styles since we are not using Tailwind by default as per system instructions, 
  // but I'll use CSS modules or standard styles in a moment.
  // Actually, I'll use standard CSS classes and define them in Button.css or index.css.
  // For now, I'll use a CSS-in-JS like approach for simplicity or just classes.
  
  return (
    <button 
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
