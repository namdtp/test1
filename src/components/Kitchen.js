import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

const Kitchen = () => {
  const [orders, setOrders] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    fetchUserEmail();
  }, []);

  const fetchOrders = () => {
    onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(data.filter(order => order.status === 'pending'));
    });
  };

  const fetchUserEmail = async () => {
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserEmail(userDoc.data().email);
      }
    }
  };

  const updateItemStatus = async (orderId, itemIndex, newStatus) => {
    try {
      const order = orders.find(order => order.id === orderId);
      const updatedItems = [...order.items];
      updatedItems[itemIndex].status = newStatus;
      await updateDoc(doc(db, 'orders', orderId), { items: updatedItems });
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái món:', err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <h2>Bếp - Đơn hàng đang chờ</h2>
      <p>Email: {userEmail}</p>
      <button onClick={handleLogout} style={styles.logout}>Đăng xuất</button>

      <div style={styles.orderList}>
        {orders.length === 0 ? (
          <p>Chưa có đơn hàng nào.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} style={styles.orderItem}>
              <div>
                <span>
                  #{order.id} - Bàn {order.tableId}: {order.items.map(item => `${item.name} (${item.quantity}) ${item.note ? `(${item.note})` : ''} [${item.status}]`).join(', ')}
                </span>
                <div style={styles.timestamp}>
                  Tạo lúc: {new Date(order.createdAt.seconds * 1000).toLocaleString()}
                </div>
              </div>
              <div style={styles.itemActions}>
                {order.items.map((item, index) => (
                  item.status === 'pending' && (
                    <div key={index} style={styles.itemAction}>
                      <span>{item.name}:</span>
                      <button
                        style={styles.serveButton}
                        onClick={() => updateItemStatus(order.id, index, 'served')}
                      >
                        Đã phục vụ
                      </button>
                    </div>
                  )
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto' },
  orderList: { marginTop: '20px' },
  orderItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: '10px',
    borderBottom: '1px solid #eee',
  },
  timestamp: { color: '#666', fontSize: '14px', marginTop: '5px' },
  itemActions: { marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' },
  itemAction: { display: 'flex', alignItems: 'center', gap: '10px' },
  serveButton: {
    padding: '5px 10px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  logout: { position: 'absolute', top: '20px', right: '20px', padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
};

export default Kitchen;