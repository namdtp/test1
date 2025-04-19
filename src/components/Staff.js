import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, getDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
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
  const [editOrderId, setEditOrderId] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const tableId = new URLSearchParams(location.search).get('tableId');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
      }
    });

    if (!tableId) {
      navigate('/tables');
    }
    fetchMenu();
    fetchOrders();
    fetchUserEmail();

    return () => unsubscribe();
  }, [tableId, navigate]);

  const fetchMenu = () => {
    onSnapshot(collection(db, 'menu'), (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setMenuItems(data.filter(item => item.available));
    });
  };

  const fetchOrders = () => {
    onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(order => order.tableId === tableId && order.status === 'pending');
      setOrders(data);
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
        history: []
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

  const addItemToExistingOrder = async () => {
    if (selectedItems.length === 0) {
      setError('Vui lòng chọn ít nhất một món để thêm!');
      return;
    }

    if (orders.length === 0) {
      setError('Không có đơn hàng đang chờ để thêm món!');
      return;
    }

    try {
      const order = orders[0];
      const updatedItems = [...order.items, ...selectedItems];

      const menuMap = menuItems.reduce((acc, item) => {
        acc[item.name] = item.price;
        return acc;
      }, {});

      const total = updatedItems.reduce((sum, item) => {
        const price = menuMap[item.name] || 0;
        return sum + (price * item.quantity);
      }, 0);

      // Bước 1: Cập nhật items
      await updateDoc(doc(db, 'orders', order.id), {
        items: updatedItems,
      });

      // Bước 2: Thêm historyEntry vào history, sử dụng thời gian phía client
      const historyEntry = {
        editedBy: auth.currentUser.uid,
        editedAt: new Date().toISOString(),
        changes: `Thêm món: ${selectedItems.map(item => `${item.name} (x${item.quantity}) ${item.note || ''}`).join(', ')}`
      };

      await updateDoc(doc(db, 'orders', order.id), {
        history: arrayUnion(historyEntry),
      });

      // Bước 3: Cập nhật tổng tiền trong tables
      await updateDoc(doc(db, 'tables', tableId), {
        total: total,
      });

      setSelectedItems([]);
      setError('');
    } catch (err) {
      setError('Lỗi khi thêm món vào đơn hàng: ' + err.message);
    }
  };

  const startEditOrder = (orderId, items) => {
    setEditOrderId(orderId);
    setEditItems(items);
  };

  const addItemToEdit = () => {
    if (selectedItems.length === 0) {
      setError('Vui lòng chọn ít nhất một món để thêm!');
      return;
    }

    const updatedItems = [...editItems, ...selectedItems];
    setEditItems(updatedItems);
    setSelectedItems([]);
    setError('');
  };

  const updateEditItem = (index, newQuantity) => {
    if (newQuantity < 1) return;
    const updatedItems = [...editItems];
    updatedItems[index].quantity = newQuantity;
    setEditItems(updatedItems);
  };

  const removeEditItem = (index) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const saveEditOrder = async () => {
    if (editItems.length === 0) {
      setError('Đơn hàng không thể trống!');
      return;
    }

    try {
      const menuMap = menuItems.reduce((acc, item) => {
        acc[item.name] = item.price;
        return acc;
      }, {});

      const total = editItems.reduce((sum, item) => {
        const price = menuMap[item.name] || 0;
        return sum + (price * item.quantity);
      }, 0);

      // Bước 1: Cập nhật items
      await updateDoc(doc(db, 'orders', editOrderId), {
        items: editItems,
      });

      // Bước 2: Thêm historyEntry vào history, sử dụng thời gian phía client
      const historyEntry = {
        editedBy: auth.currentUser.uid,
        editedAt: new Date().toISOString(),
        changes: `Chỉnh sửa đơn hàng: Cập nhật danh sách món`
      };

      await updateDoc(doc(db, 'orders', editOrderId), {
        history: arrayUnion(historyEntry),
      });

      // Bước 3: Cập nhật tổng tiền trong tables
      await updateDoc(doc(db, 'tables', tableId), {
        total: total,
      });

      setEditOrderId(null);
      setEditItems([]);
      setError('');
    } catch (err) {
      setError('Lỗi khi lưu chỉnh sửa đơn hàng: ' + err.message);
    }
  };

  const cancelEditOrder = () => {
    setEditOrderId(null);
    setEditItems([]);
    setError('');
  };

  const handlePayOrder = async (orderId, paymentMethod) => {
    if (!paymentMethod) {
      setError('Vui lòng chọn phương thức thanh toán!');
      return;
    }

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        setError('Không tìm thấy đơn hàng!');
        return;
      }

      const allItemsServed = order.items.every(item => item.status === 'served');
      if (!allItemsServed) {
        setError('Tất cả món phải được phục vụ trước khi thanh toán!');
        return;
      }

      // Bước 1: Cập nhật các trường chính
      await updateDoc(doc(db, 'orders', orderId), {
        paidAt: serverTimestamp(),
        paymentMethod: paymentMethod,
        status: 'completed',
      });

      // Bước 2: Thêm historyEntry vào history, sử dụng thời gian phía client
      const historyEntry = {
        editedBy: auth.currentUser.uid,
        editedAt: new Date().toISOString(),
        changes: `Thanh toán đơn hàng - Phương thức: ${paymentMethod}`
      };

      await updateDoc(doc(db, 'orders', orderId), {
        history: arrayUnion(historyEntry),
      });

      // Bước 3: Cập nhật trạng thái bàn
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
      return new Date(timestamp.seconds * 1000).toLocaleString('vi-VN');
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleString('vi-VN');
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString('vi-VN');
    }
    return 'Invalid Date';
  };

  const calculateOrderTotal = (order) => {
    const menuMap = menuItems.reduce((acc, item) => {
      acc[item.name] = item.price;
      return acc;
    }, {});
    return order.items.reduce((sum, item) => {
      const price = menuMap[item.name] || 0;
      return sum + (price * item.quantity);
    }, 0);
  };

  const calculateTotal = (items) => {
    const menuMap = menuItems.reduce((acc, item) => {
      acc[item.name] = item.price;
      return acc;
    }, {});
    return items.reduce((sum, item) => {
      const price = menuMap[item.name] || 0;
      return sum + (price * item.quantity);
    }, 0);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Nhân viên Order - Bàn {tableId}</h2>
      <p style={styles.email}>Email: {userEmail}</p>
      <button onClick={handleLogout} style={styles.logout}>Đăng xuất</button>
      <button onClick={() => navigate('/tables')} style={styles.backButton}>Quay lại danh sách bàn</button>

      <div style={styles.section}>
        <h3>{orders.length > 0 ? 'Thêm Món Vào Đơn Hàng' : 'Tạo Đơn Hàng'}</h3>
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
                  {item.name} - {item.price.toLocaleString('vi-VN')} ₫ ({item.category})
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

          <h4 style={styles.subTitle}>Món Đã Chọn</h4>
          {selectedItems.length === 0 ? (
            <p>Chưa có món nào được chọn.</p>
          ) : (
            <div style={styles.selectedItemsContainer}>
              {selectedItems.map((item, index) => (
                <div key={index} style={styles.selectedItem}>
                  <span style={styles.itemText}>
                    {item.name} (x{item.quantity}) {item.note && `- ${item.note}`}
                    <span style={styles.itemPrice}>
                      {' '}
                      - {((menuItems.find(menuItem => menuItem.name === item.name)?.price || 0) * item.quantity).toLocaleString('vi-VN')} ₫
                    </span>
                  </span>
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
              ))}
              <div style={styles.total}>
                Tổng: {calculateTotal(selectedItems).toLocaleString('vi-VN')} ₫
              </div>
            </div>
          )}

          <button
            style={styles.button}
            onClick={orders.length > 0 ? addItemToExistingOrder : handleCreateOrder}
          >
            {orders.length > 0 ? 'Thêm Vào Đơn Hàng' : 'Tạo Đơn'}
          </button>
          {error && <p style={styles.error}>{error}</p>}
        </div>
      </div>

      {editOrderId && (
        <div style={styles.section}>
          <h3>Chỉnh Sửa Đơn Hàng #{editOrderId}</h3>
          <div style={styles.form}>
            <h4 style={styles.subTitle}>Danh Sách Món</h4>
            {editItems.length === 0 ? (
              <p>Chưa có món nào.</p>
            ) : (
              <div style={styles.selectedItemsContainer}>
                {editItems.map((item, index) => (
                  <div key={index} style={styles.selectedItem}>
                    <span style={styles.itemText}>
                      {item.name} (x{item.quantity}) {item.note && `- ${item.note}`}
                      <span style={styles.itemPrice}>
                        {' '}
                        - {((menuItems.find(menuItem => menuItem.name === item.name)?.price || 0) * item.quantity).toLocaleString('vi-VN')} ₫
                      </span>
                    </span>
                    <div style={styles.itemActions}>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateEditItem(index, parseInt(e.target.value) || 1)}
                        style={styles.quantityInput}
                      />
                      <button
                        style={styles.removeButton}
                        onClick={() => removeEditItem(index)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
                <div style={styles.total}>
                  Tổng: {calculateTotal(editItems).toLocaleString('vi-VN')} ₫
                </div>
              </div>
            )}

            <div style={styles.actions}>
              <button style={styles.button} onClick={saveEditOrder}>
                Lưu
              </button>
              <button style={styles.removeButton} onClick={cancelEditOrder}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.section}>
        <h3>Danh Sách Đơn Hàng - Bàn {tableId}</h3>
        <div style={styles.orderList}>
          {orders.length === 0 ? (
            <p>Chưa có đơn hàng nào đang chờ xử lý.</p>
          ) : (
            orders.map((order) => (
              <div key={order.id} style={styles.orderItem}>
                <div style={styles.orderDetails}>
                  <span style={styles.orderId}>#{order.id}</span>
                  <div style={styles.orderItems}>
                    {order.items.map((item, index) => (
                      <div key={index} style={styles.orderItemDetail}>
                        {item.name} (x{item.quantity}) {item.note && `- ${item.note}`} [{item.status}]
                      </div>
                    ))}
                  </div>
                  <div style={styles.orderMeta}>
                    <span style={styles.orderStatus}>Trạng thái: {order.status}</span>
                    <span>Tổng: {calculateOrderTotal(order).toLocaleString('vi-VN')} ₫</span>
                    <span>Tạo lúc: {formatTimestamp(order.createdAt)}</span>
                    {order.paidAt && (
                      <span>
                        Thanh toán lúc: {formatTimestamp(order.paidAt)} - Phương thức: {order.paymentMethod}
                      </span>
                    )}
                  </div>
                </div>
                {order.status === 'pending' && (
                  <div style={styles.actions}>
                    <button
                      style={styles.button}
                      onClick={() => startEditOrder(order.id, order.items)}
                    >
                      Chỉnh Sửa
                    </button>
                    <select
                      onChange={(e) => handlePayOrder(order.id, e.target.value)}
                      style={styles.select}
                      defaultValue=""
                    >
                      <option value="" disabled>Chọn phương thức thanh toán</option>
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
    </div>
  );
};

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' },
  email: { fontSize: '16px', color: '#666', marginBottom: '20px' },
  logout: { 
    position: 'absolute', 
    top: '20px', 
    right: '20px', 
    padding: '10px', 
    backgroundColor: '#dc3545', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer' 
  },
  backButton: { 
    padding: '10px 15px', 
    backgroundColor: '#6c757d', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    marginBottom: '20px' 
  },
  section: { 
    marginBottom: '40px', 
    padding: '20px', 
    backgroundColor: '#f8f9fa', 
    borderRadius: '8px', 
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
  },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  menuSelect: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    flexWrap: 'wrap' 
  },
  select: { 
    padding: '10px', 
    borderRadius: '4px', 
    border: '1px solid #ccc', 
    flex: '1', 
    minWidth: '200px' 
  },
  quantityInput: { 
    padding: '10px', 
    width: '80px', 
    border: '1px solid #ccc', 
    borderRadius: '4px', 
    textAlign: 'center' 
  },
  noteInput: { 
    padding: '10px', 
    border: '1px solid #ccc', 
    borderRadius: '4px', 
    flex: '1', 
    minWidth: '200px' 
  },
  addButton: { 
    padding: '10px 20px', 
    backgroundColor: '#007bff', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer' 
  },
  subTitle: { fontSize: '18px', fontWeight: 'bold', marginTop: '20px' },
  selectedItemsContainer: { 
    border: '1px solid #eee', 
    borderRadius: '4px', 
    padding: '10px', 
    backgroundColor: '#fff' 
  },
  selectedItem: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '10px 0', 
    borderBottom: '1px solid #eee' 
  },
  itemText: { flex: '1', fontSize: '16px' },
  itemPrice: { color: '#28a745', fontWeight: 'bold' },
  itemActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  removeButton: { 
    padding: '5px 10px', 
    backgroundColor: '#dc3545', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer' 
  },
  total: { 
    fontSize: '16px', 
    fontWeight: 'bold', 
    marginTop: '10px', 
    textAlign: 'right', 
    color: '#28a745' 
  },
  button: { 
    padding: '12px', 
    backgroundColor: '#28a745', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    fontSize: '16px', 
    fontWeight: 'bold', 
    marginRight: '10px' 
  },
  error: { color: 'red', marginTop: '10px', fontSize: '14px' },
  orderList: { marginTop: '20px' },
  orderItem: { 
    display: 'flex', 
    flexDirection: 'column', 
    padding: '15px', 
    border: '1px solid #eee', 
    borderRadius: '4px', 
    marginBottom: '10px', 
    backgroundColor: '#fff' 
  },
  orderDetails: { flex: '1' },
  orderId: { fontWeight: 'bold', fontSize: '16px', color: '#007bff' },
  orderItems: { margin: '10px 0', fontSize: '15px', color: '#333' },
  orderItemDetail: { marginBottom: '5px' },
  orderMeta: { 
    fontSize: '14px', 
    color: '#666', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '5px' 
  },
  orderStatus: { fontWeight: 'bold', color: '#007bff' },
  actions: { 
    marginTop: '10px', 
    display: 'flex', 
    justifyContent: 'flex-end', 
    gap: '10px' 
  },
};

export default Staff;