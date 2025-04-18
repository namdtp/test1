import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

const Staff = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [currentItem, setCurrentItem] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentNote, setCurrentNote] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const tableId = new URLSearchParams(location.search).get('tableId');

  useEffect(() => {
    if (!tableId) {
      navigate('/tables');
    }
    fetchMenu();
    fetchOrders();
    fetchUserEmail();
  }, [tableId, navigate]);

  const fetchMenu = () => {
    onSnapshot(collection(db, 'menu'), (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setMenuItems(data.filter(item => item.available));
    });
  };

  const fetchOrders = () => {
    onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(data.filter(order => order.tableId === tableId));
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

  const addItemToOrder = () => {
    if (!currentItem || currentQuantity < 1) {
      setError('Vui lòng chọn món và nhập số lượng hợp lệ!');
      return;
    }

    const existingItemIndex = selectedItems.findIndex(item => item.name === currentItem && item.note === currentNote);
    if (existingItemIndex !== -1) {
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex].quantity += currentQuantity;
      setSelectedItems(updatedItems);
    } else {
      setSelectedItems([...selectedItems, { name: currentItem, quantity: currentQuantity, note: currentNote, status: 'pending' }]);
    }

    setCurrentItem('');
    setCurrentQuantity(1);
    setCurrentNote('');
    setError('');
  };

  const removeItemFromOrder = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateQuantity = (index, newQuantity) => {
    if (newQuantity < 1) return;
    const updatedItems = [...selectedItems];
    updatedItems[index].quantity = newQuantity;
    setSelectedItems(updatedItems);
  };

  const handleCreateOrder = async () => {
    if (selectedItems.length === 0) {
      setError('Vui lòng chọn ít nhất một món!');
      return;
    }

    try {
      const menuMap = menuItems.reduce((acc, item) => {
        acc[item.name] = item.price;
        return acc;
      }, {});

      const total = selectedItems.reduce((sum, item) => {
        const price = menuMap[item.name] || 0;
        return sum + (price * item.quantity);
      }, 0);

      const orderRef = await addDoc(collection(db, 'orders'), {
        tableId: tableId,
        items: selectedItems,
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        paidAt: null,
        paymentMethod: null,
      });

      await updateDoc(doc(db, 'tables', tableId), {
        status: 'occupied',
        currentOrderId: orderRef.id,
        total: total,
      });

      setSelectedItems([]);
      setError('');
    } catch (err) {
      setError('Lỗi khi tạo đơn hàng: ' + err.message);
    }
  };

  const handlePayOrder = async (orderId, paymentMethod) => {
    if (!paymentMethod) {
      setError('Vui lòng chọn phương thức thanh toán!');
      return;
    }

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        paidAt: serverTimestamp(),
        paymentMethod: paymentMethod,
        status: 'completed',
      });

      await updateDoc(doc(db, 'tables', tableId), {
        status: 'available',
        currentOrderId: null,
        total: 0,
      });

      setError('');
    } catch (err) {
      setError('Lỗi khi thanh toán: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString();
    }
    return 'Invalid Date';
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Nhân viên Order - Bàn {tableId}</h2>
      <p style={styles.email}>Email: {userEmail}</p>
      <button onClick={handleLogout} style={styles.logout}>Đăng xuất</button>
      <button onClick={() => navigate('/tables')} style={styles.backButton}>Quay lại danh sách bàn</button>

      <h3 style={styles.sectionTitle}>Tạo đơn hàng</h3>
      <div style={styles.form}>
        <div style={styles.menuSelect}>
          <select
            value={currentItem}
            onChange={(e) => setCurrentItem(e.target.value)}
            style={styles.select}
          >
            <option value="">Chọn món</option>
            {menuItems.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} - {item.price} VND ({item.category})
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={currentQuantity}
            onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
            style={styles.quantityInput}
          />
          <input
            type="text"
            placeholder="Ghi chú (nếu có)"
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            style={styles.noteInput}
          />
          <button style={styles.addButton} onClick={addItemToOrder}>
            Thêm
          </button>
        </div>

        <h4 style={styles.subSectionTitle}>Món đã chọn:</h4>
        {selectedItems.length === 0 ? (
          <p>Chưa có món nào được chọn.</p>
        ) : (
          selectedItems.map((item, index) => (
            <div key={index} style={styles.selectedItem}>
              <span>{item.name} (Số lượng: {item.quantity}) {item.note && `- Ghi chú: ${item.note}`}</span>
              <div style={styles.itemActions}>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                  style={styles.quantityInput}
                />
                <button
                  style={styles.removeButton}
                  onClick={() => removeItemFromOrder(index)}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))
        )}

        {selectedItems.length > 0 && (
          <p style={styles.total}>
            Tổng giá: {selectedItems.reduce((sum, item) => {
              const price = menuItems.find(menuItem => menuItem.name === item.name)?.price || 0;
              return sum + (price * item.quantity);
            }, 0)} VND
          </p>
        )}

        <button style={styles.createButton} onClick={handleCreateOrder}>
          Tạo đơn
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </div>

      <h3 style={styles.sectionTitle}>Danh sách đơn hàng - Bàn {tableId}</h3>
      <div style={styles.orderList}>
        {orders.length === 0 ? (
          <p>Chưa có đơn hàng nào.</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} style={styles.orderItem}>
              <div>
                <span>
                  #{order.id}: {order.items.map(item => `${item.name} (${item.quantity}) ${item.note ? `(${item.note})` : ''}`).join(', ')} - {order.status}
                </span>
                <div style={styles.timestamp}>
                  Tạo lúc: {formatTimestamp(order.createdAt)}
                </div>
                {order.paidAt && (
                  <div style={styles.timestamp}>
                    Thanh toán lúc: {formatTimestamp(order.paidAt)} - Phương thức: {order.paymentMethod}
                  </div>
                )}
              </div>
              {order.status === 'pending' && (
                <div style={styles.actions}>
                  <select
                    onChange={(e) => handlePayOrder(order.id, e.target.value)}
                    style={styles.select}
                    defaultValue=""
                  >
                    <option value="" disabled>Thanh toán</option>
                    <option value="cash">Tiền mặt</option>
                    <option value="card">Thẻ</option>
                  </select>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' },
  email: { fontSize: '16px', color: '#666', marginBottom: '20px' },
  sectionTitle: { fontSize: '20px', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' },
  subSectionTitle: { fontSize: '18px', marginTop: '10px', marginBottom: '10px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px', border: '1px solid #eee', padding: '15px', borderRadius: '5px', backgroundColor: '#f9f9f9' },
  menuSelect: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' },
  select: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc', flex: 1, fontSize: '14px' },
  quantityInput: { padding: '10px', width: '80px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' },
  noteInput: { padding: '10px', border: '1px solid #ccc', borderRadius: '4px', flex: 1, fontSize: '14px' },
  addButton: { padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  selectedItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    borderBottom: '1px solid #eee',
  },
  itemActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  removeButton: {
    padding: '5px 10px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  total: { fontSize: '16px', fontWeight: 'bold', color: '#333', marginTop: '10px' },
  createButton: { padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  orderList: { marginTop: '20px' },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#fff',
    borderRadius: '5px',
    marginBottom: '10px',
  },
  timestamp: { color: '#666', fontSize: '14px', marginTop: '5px' },
  logout: { position: 'absolute', top: '20px', right: '20px', padding: '10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  backButton: { padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' },
  error: { color: 'red', marginTop: '10px', fontSize: '14px' },
  actions: { display: 'flex', gap: '10px' },
};

export default Staff;