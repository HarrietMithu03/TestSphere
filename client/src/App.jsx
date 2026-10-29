import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/Layout';
import DashboardHome from './pages/DashboardHome';
import TargetsPage from './pages/targets/TargetsPage';
import ScanHistoryPage from './pages/scans/ScanHistoryPage';
import ScanDetailsPage from './pages/scans/ScanDetailsPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ReportsListPage from './pages/reports/ReportsListPage';
import ReportDetailsPage from './pages/reports/ReportDetailsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Standalone SaaS Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Main Application Routes inside Layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardHome />} />
            <Route
              path="targets"
              element={
                <ProtectedRoute>
                  <TargetsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="scans"
              element={
                <ProtectedRoute>
                  <ScanHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="scans/:id"
              element={
                <ProtectedRoute>
                  <ScanDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute>
                  <ReportsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports/:id"
              element={
                <ProtectedRoute>
                  <ReportDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
