import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import DoctorDirectory from './pages/patient/DoctorDirectory';
import DoctorDetails from './pages/patient/DoctorDetails';
import AdminDashboard from './pages/admin/AdminDashboard';
import MyAppointments from './pages/MyAppointments';
import Prescriptions from './pages/Prescriptions';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <Navbar />

      <main className="flex-grow">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/doctors" element={<DoctorDirectory />} />
          <Route path="/doctors/:id" element={<DoctorDetails />} />

          {/* Protected Routes (Requires valid JWT & authenticated user) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/appointments" element={<MyAppointments />} />
            <Route path="/prescriptions" element={<Prescriptions />} />
          </Route>
          {/* Admin Protected Routes (Requires authenticated user with 'admin' role) */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 DocCare Healthcare System. Digital Prescriptions & Telehealth Active.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

