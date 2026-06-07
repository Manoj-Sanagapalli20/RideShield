import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Footer from './components/Footer';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Toaster position="top-center" reverseRide={false} />
      <Routes>
        <Route path="/" element={
          <>
            <Navbar />
            <main>
              <Hero />
            </main>
            <Footer />
          </>
        } />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </div>
  );
}

export default App;
