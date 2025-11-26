import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './dashboardLayout.css';

const DashboardLayout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <div className="dashboard-layout">
      {/* Hamburger Button */}
      <button className="hamburger-btn" onClick={toggleMenu} aria-label="Toggle menu">
        <span className="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      {/* Overlay */}
      <div 
        className={`sidebar-overlay ${isMenuOpen ? 'active' : ''}`} 
        onClick={closeMenu}
      ></div>

      {/* Sidebar */}
      <nav className={`sidebar ${isMenuOpen ? 'open' : ''}`}>
        <button className="close-btn" onClick={closeMenu} aria-label="Close menu">
          ✕
        </button>
        <div className="sidebar-nav">
          <NavLink 
            to="/dashboard" 
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Dashboard
          </NavLink>
          <NavLink 
            to="/dashboard/decks" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Decks
          </NavLink>
          <NavLink 
            to="/dashboard/settings" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Settings
          </NavLink>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
