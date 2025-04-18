import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

const Tables = () => {
  const [tables, setTables] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTables(data);
    });
    fetchUserEmail();
    return () => unsubscribe();
  }, []);

  const fetchUserEmail = async () => {
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserEmail(userDoc.data().email);
      }
    }
  };

  const handleSelectTable = (tableId) => {
    navigate(`/staff?tableId=${tableId}`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <h2>Quản lý Bàn</h2>
      <p>Email: {userEmail}</p>
      <button onClick={handleLogout} style={styles.logout}>Đăng xuất</button>
      <div style={styles.tableList}>
        {tables.map((table) => (
          <div
            key={table.id}
            style={{
              ...styles.tableItem,
              backgroundColor: table.status === 'available' ? '#28a745' : '#dc3545',
            }}
            onClick={() => handleSelectTable(table.id)}
          >
            <span>Bàn {table.id}</span>
            <span>Trạng thái: {table.status === 'available' ? 'Trống' : 'Đã chiếm'}</span>
            {table.currentOrderId && <span>Đơn hàng: {table.currentOrderId}</span>}
            <span>Tổng: {table.total || 0} VND</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto' },
  tableList: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  tableItem: {
    padding: '10px',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    width: '150px',
    textAlign: 'center',
  },
  logout: { position: 'absolute', top: '20px', right: '20px', padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
};

export default Tables;