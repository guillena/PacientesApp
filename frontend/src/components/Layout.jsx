import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { 
  Calendar, 
  Users, 
  LayoutDashboard, 
  Settings, 
  LogOut,
  Flower2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import logo from '../assets/Logokume.png';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="sidebar" style={{ 
        width: isSidebarOpen ? '260px' : '80px', 
        padding: '2rem 1rem', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        transition: 'width 0.3s ease',
        overflowX: 'hidden'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginBottom: '2rem'
        }}>
          <div style={{ 
            height: '60px', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            opacity: isSidebarOpen ? 1 : 0,
            pointerEvents: isSidebarOpen ? 'auto' : 'none',
            transition: 'opacity 0.2s',
            marginBottom: '1.5rem',
            paddingLeft: '12px',
            whiteSpace: 'nowrap'
          }}>
            <img src={logo} alt="Kümespacio Logo" style={{ maxWidth: '140px' }} />
            {import.meta.env.DEV && (
              <span style={{ color: 'red', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Development</span>
            )}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{ 
              background: 'transparent', border: 'none', cursor: 'pointer', 
              padding: '8px 12px', color: 'var(--dark-text)', display: 'flex' 
            }}
            title={isSidebarOpen ? "Contraer menú" : "Expandir menú"}
          >
            {isSidebarOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
          </button>
        </div>

        <nav style={{ flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li>
              <NavLink to="/" style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 1rem',
                borderRadius: '12px',
                textDecoration: 'none',
                color: 'var(--dark-text)',
                backgroundColor: isActive ? 'var(--salmon)' : 'transparent',
                marginBottom: '8px',
                fontWeight: '600',
                justifyContent: 'flex-start'
              })} title="Inicio">
                <LayoutDashboard size={20} style={{ minWidth: '20px' }} />
                {isSidebarOpen && <span>Inicio</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/agenda" style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 1rem',
                borderRadius: '12px',
                textDecoration: 'none',
                color: 'var(--dark-text)',
                backgroundColor: isActive ? 'var(--salmon)' : 'transparent',
                marginBottom: '8px',
                fontWeight: '600',
                justifyContent: 'flex-start'
              })} title="Mi Agenda">
                <Calendar size={20} style={{ minWidth: '20px' }} />
                {isSidebarOpen && <span>Mi Agenda</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/patients" style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 1rem',
                borderRadius: '12px',
                textDecoration: 'none',
                color: 'var(--dark-text)',
                backgroundColor: isActive ? 'var(--salmon)' : 'transparent',
                marginBottom: '8px',
                fontWeight: '600',
                justifyContent: 'flex-start'
              })} title="Pacientes">
                <Users size={20} style={{ minWidth: '20px' }} />
                {isSidebarOpen && <span>Pacientes</span>}
              </NavLink>
            </li>
            {user?.role === 'admin' && (
              <li>
                <NavLink to="/admin" style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 1rem',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: 'var(--dark-text)',
                  backgroundColor: isActive ? 'var(--salmon)' : 'transparent',
                  marginBottom: '8px',
                  fontWeight: '600',
                  justifyContent: 'flex-start'
                })} title="Administración">
                  <Settings size={20} style={{ minWidth: '20px' }} />
                  {isSidebarOpen && <span>Administración</span>}
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          {isSidebarOpen && (
            <div style={{ marginBottom: '1rem', padding: '0 0.5rem' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.firstName} {user?.lastName}</p>
              <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>{user?.role === 'admin' ? 'Administrador' : 'Profesional'}</p>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="btn"
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '10px 1rem',
              color: '#e74c3c',
              background: 'transparent',
              justifyContent: 'flex-start'
            }}
            title="Cerrar Sesión"
          >
            <LogOut size={20} style={{ minWidth: '20px' }} />
            {isSidebarOpen && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: isSidebarOpen ? '260px' : '80px', padding: '2rem', transition: 'margin-left 0.3s ease', width: '100%', overflowX: 'hidden' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
