import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authUtils } from './utils/api';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DwellingDetails from './pages/DwellingDetails';

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return authUtils.isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route component (redirect to dashboard if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return authUtils.isAuthenticated() ? <Navigate to="/" replace /> : <>{children}</>;
};

function App() {
  return (
    <Router>
      <div className="App">
        {authUtils.isAuthenticated() && <Navbar />}
        
        <main className="main-content">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            
            <Route path="/register" element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } />

            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/dwelling/:dwellingId" element={
              <ProtectedRoute>
                <DwellingDetails />
              </ProtectedRoute>
            } />

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 