import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { authUtils } from '../utils/api.ts';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = authUtils.getCurrentUser();

  const handleLogout = () => {
    authUtils.clearAuth();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-content">
          <Link to="/" className="navbar-brand">
            HEMS Emulator
          </Link>

          <div className="navbar-nav">
            <div className="navbar-user">
              <User size={16} />
              <span>{currentUser?.email}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              title="Logout"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 