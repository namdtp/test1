import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { auth } from './firebaseConfig';
import { useAuthState } from 'react-firebase-hooks/auth';
import Login from './components/Login';
import Staff from './components/Staff';
import Kitchen from './components/Kitchen';
import Manager from './components/Manager';
import Tables from './components/Tables';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

const App = () => {
  const [user, loading] = useAuthState(auth);

  if (loading) return <div>Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/staff"
          element={user ? <Staff /> : <Navigate to="/login" />}
        />
        <Route
          path="/kitchen"
          element={user ? <Kitchen /> : <Navigate to="/login" />}
        />
        <Route
          path="/manager/*"
          element={user ? <Manager /> : <Navigate to="/login" />}
        />
        <Route
          path="/tables"
          element={user ? <Tables /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
};

export default App;