import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import OrderManagement from './manager/OrderManagement';
import MenuManagement from './manager/MenuManagement';
import TableManagement from './manager/TableManagement';

const Manager = () => {
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserEmail();
  }, []);

  const fetchUserEmail = async () => {
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserEmail(userDoc.data().email);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <div style={styles.navLinks}>
          <Link to="/manager/orders" style={styles.navLink}>Quản lý Order</Link>
          <Link to="/manager/menu" style={styles.navLink}>Quản lý Menu</Link>
          <Link to="/manager/tables" style={styles.navLink}>Quản lý Bàn</Link>
        </div>
        <div>
          <span style={styles.email}>Email: {userEmail}</span>
          <button onClick={handleLogout} style={styles.logout}>
            Đăng xuất
          </button>
        </div>
      </nav>

      <div style={styles.content}>
        <Routes>
          <Route path="orders" element={<OrderManagement />} />
          <Route path="menu" element={<MenuManagement />} />
          <Route path="tables" element={<TableManagement />} />
          <Route path="/" element={<OrderManagement />} />
        </Routes>
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '20px', maxWidth: '1200px', margin: '0 auto' },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: '10px 20px',
    borderRadius: '5px',
    marginBottom: '20px',
  },
  navLinks: {
    display: 'flex',
    gap: '20px',
  },
  navLink: {
    textDecoration: 'none',
    color: '#007bff',
    fontWeight: 'bold',
    fontSize: '16px',
  },
  email: {
    marginRight: '20px',
    fontSize: '16px',
    color: '#666',
  },
  logout: {
    padding: '10px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  content: { marginTop: '20px' },
};

export default Manager;