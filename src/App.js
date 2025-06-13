import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth } from './firebaseConfig';
import { useAuthState } from 'react-firebase-hooks/auth';
import Login from './components/Login';
import Staff from './components/Staff';
import Kitchen from './components/Kitchen';
import Manager from './components/Manager';
import Tables from './components/Tables';
import Order from './components/Order';
import OrderCart from './components/OrderCart';
import { MenuProvider } from './contexts/MenuContext';
import { CssBaseline } from '@mui/material';

const SESSION_TIMEOUT = 6 * 60 * 60 * 1000; // 6 tiếng

const App = () => {
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();

  // Logout sau 6 tiếng
  useEffect(() => {
    if (user) {
      const loginTime = parseInt(localStorage.getItem('loginTime') || '0', 10);
      if (loginTime && Date.now() - loginTime > SESSION_TIMEOUT) {
        auth.signOut();
        localStorage.removeItem('loginTime');
        sessionStorage.removeItem('loggedIn');
        navigate('/login');
      }
    }
  }, [user, navigate]);

  // Auto logout khi đóng tất cả tab
  // useEffect(() => {
  //   const handleBeforeUnload = () => {
  //     auth.signOut();
  //     localStorage.removeItem('loginTime');
  //     sessionStorage.removeItem('loggedIn');
  //   };
  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <MenuProvider>
      <CssBaseline />
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
        <Route
          path="/order"
          element={user ? <Order /> : <Navigate to="/login" />}
        />
        <Route
          path="/order/cart"
          element={user ? <OrderCart /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </MenuProvider>
  );
};

export default App;
