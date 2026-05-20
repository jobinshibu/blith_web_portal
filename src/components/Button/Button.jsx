import React from 'react';
import './Button.scss';

const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
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
