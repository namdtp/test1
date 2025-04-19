import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [orderHistories, setOrderHistories] = useState({});
  const [filterStatus, setFilterStatus] = useState('All');
  const [error, setError] = useState('');
  const [editOrderId, setEditOrderId] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, note: '', status: 'pending' });

  useEffect(() => {
    fetchOrders();
    fetchMenu();
  }, []);

  const fetchOrders = () => {
    onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      setOrders(data);

      // Kiểm tra xem có bàn nào có nhiều đơn hàng pending không
      const pendingOrdersByTable = data.reduce((acc, order) => {
        if (order.status === 'pending') {
          if (!acc[order.tableId]) {
            acc[order.tableId] = [];
          }
          acc[order.tableId].push(order);
        }
        return acc;
      }, {});

      const tablesWithMultipleOrders = Object.keys(pendingOrdersByTable).filter(
        (tableId) => pendingOrdersByTable[tableId].length > 1
      );

      if (tablesWithMultipleOrders.length > 0) {
        setError(
          `Canh bao: Cac ban ${tablesWithMultipleOrders.join(', ')} co nhieu don hang dang cho! Vui long xu ly truoc khi tiep tuc.`
        );
      } else {
        setError('');
      }

      data.forEach((order) => {
        onSnapshot(collection(db, 'orders', order.id, 'orderHistory'), (historySnapshot) => {
          const historyData = historySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.editedAt?.seconds || 0) - (a.editedAt?.seconds || 0));
          setOrderHistories((prev) => ({
            ...prev,
            [order.id]: historyData
          }));
        });
      });
    });
  };

  const fetchMenu = () => {
    onSnapshot(collection(db, 'menu'), (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setMenuItems(data.filter(item => item.available));
    });
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const order = orders.find(order => order.id === orderId);

      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus
      });

      const historyRef = doc(collection(db, 'orders', orderId, 'orderHistory'));
      await setDoc(historyRef, {
        editedBy: auth.currentUser.uid,
        editedAt: serverTimestamp(),
        changes: `Cap nhat trang thai don hang tu ${order.status} thanh ${newStatus}`
      });

      if (newStatus !== 'pending') {
        await updateDoc(doc(db, 'tables', order.tableId), {
          status: 'available',
          currentOrderId: null,
          total: 0,
        });
      }
      setError('');
    } catch (err) {
      setError('Loi khi cap nhat trang thai: ' + err.message);
    }
  };

  const updateItemStatus = async (orderId, itemIndex, newStatus) => {
    try {
      const order = orders.find(order => order.id === orderId);
      const updatedItems = [...order.items];
      const oldStatus = updatedItems[itemIndex].status;
      updatedItems[itemIndex].status = newStatus;

      await updateDoc(doc(db, 'orders', orderId), {
        items: updatedItems
      });

      const historyRef = doc(collection(db, 'orders', orderId, 'orderHistory'));
      await setDoc(historyRef, {
        editedBy: auth.currentUser.uid,
        editedAt: serverTimestamp(),
        changes: `Cap nhat trang thai mon ${updatedItems[itemIndex].name} tu ${oldStatus} thanh ${newStatus}`
      });

      setError('');
    } catch (err) {
      setError('Loi khi cap nhat trang thai mon: ' + err.message);
    }
  };

  const handlePayOrder = async (orderId, paymentMethod) => {
    if (!paymentMethod) {
      setError('Vui long chon phuong thuc thanh toan!');
      return;
    }

    if (!auth.currentUser) {
      setError('Vui long dang nhap lai de thuc hien thanh toan!');
      return;
    }

    try {
      const order = orders.find(order => order.id === orderId);
      const allItemsServed = order.items.every(item => item.status === 'served');
      if (!allItemsServed) {
        setError('Tat ca mon phai duoc phuc vu truoc khi thanh toan!');
        return;
      }

      await updateDoc(doc(db, 'orders', orderId), {
        paidAt: serverTimestamp(),
        paymentMethod: paymentMethod,
        status: 'completed'
      });

      const historyRef = doc(collection(db, 'orders', orderId, 'orderHistory'));
      await setDoc(historyRef, {
        editedBy: auth.currentUser.uid,
        editedAt: serverTimestamp(),
        changes: `Thanh toan don hang - Phuong thuc: ${paymentMethod}`
      });

      await updateDoc(doc(db, 'tables', order.tableId), {
        status: 'available',
        currentOrderId: null,
        total: 0,
      });

      setError('');
    } catch (err) {
      setError('Loi khi thanh toan: ' + err.message);
    }
  };

  const startEditOrder = (order) => {
    setEditOrderId(order.id);
    setEditItems([...order.items]);
  };

  const addItemToEdit = () => {
    if (!newItem.name || newItem.quantity < 1) {
      setError('Vui long chon mon va nhap so luong hop le!');
      return;
    }

    setEditItems([...editItems, { ...newItem }]);
    setNewItem({ name: '', quantity: 1, note: '', status: 'pending' });
    setError('');
  };

  const updateEditItem = (index, field, value) => {
    const updatedItems = [...editItems];
    updatedItems[index][field] = value;
    setEditItems(updatedItems);
  };

  const removeEditItem = (index) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const saveEditOrder = async (orderId) => {
    try {
      const order = orders.find(order => order.id === orderId);
      const changes = [];

      order.items.forEach((oldItem, index) => {
        const newItem = editItems[index];
        if (!newItem) {
          changes.push(`Xoa mon ${oldItem.name}`);
        } else if (oldItem.quantity !== newItem.quantity) {
          changes.push(`Cap nhat so luong mon ${oldItem.name} tu ${oldItem.quantity} thanh ${newItem.quantity}`);
        } else if (oldItem.note !== newItem.note) {
          changes.push(`Cap nhat ghi chu mon ${oldItem.name} thanh "${newItem.note}"`);
        }
      });

      editItems.forEach((newItem, index) => {
        if (!order.items[index]) {
          changes.push(`Them mon ${newItem.name} (x${newItem.quantity})`);
        }
      });

      await updateDoc(doc(db, 'orders', orderId), {
        items: editItems
      });

      const historyRef = doc(collection(db, 'orders', orderId, 'orderHistory'));
      await setDoc(historyRef, {
        editedBy: auth.currentUser.uid,
        editedAt: serverTimestamp(),
        changes: changes.join('; ')
      });

      const total = calculateOrderTotal({ items: editItems });
      await updateDoc(doc(db, 'tables', order.tableId), {
        total: total
      });

      setEditOrderId(null);
      setEditItems([]);
      setError('');
    } catch (err) {
      setError('Loi khi luu chinh sua: ' + err.message);
    }
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

  const filteredOrders = filterStatus === 'All'
    ? orders
    : orders.filter(order => order.status === filterStatus);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000).toLocaleString('vi-VN');
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString('vi-VN');
    }
    return 'Invalid Date';
  };

  return (
    <div>
      <h3>Quan ly Order</h3>

      <div style={styles.header}>
        <div style={styles.filter}>
          <label>Loc theo trang thai: </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={styles.select}
          >
            <option value="All">Tat ca</option>
            <option value="pending">Dang cho</option>
            <option value="completed">Hoan thanh</option>
            <option value="cancelled">Da huy</option>
          </select>
        </div>
      </div>

      <h4>Danh sach don hang</h4>
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.orderList}>
        {filteredOrders.length === 0 ? (
          <p>Chua co don hang nao.</p>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} style={styles.orderItem}>
              {editOrderId === order.id ? (
                <div style={styles.editForm}>
                  <h5>Chinh sua don hang #{order.id}</h5>
                  <div style={styles.addItemForm}>
                    <select
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      style={styles.select}
                    >
                      <option value="">Chon mon</option>
                      {menuItems.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name} - {item.price.toLocaleString('vi-VN')} VND
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                      style={styles.quantityInput}
                    />
                    <input
                      type="text"
                      placeholder="Ghi chu"
                      value={newItem.note}
                      onChange={(e) => setNewItem({ ...newItem, note: e.target.value })}
                      style={styles.noteInput}
                    />
                    <button style={styles.addButton} onClick={addItemToEdit}>
                      Them mon
                    </button>
                  </div>
                  <div style={styles.editItems}>
                    {editItems.map((item, index) => (
                      <div key={index} style={styles.editItem}>
                        <span>{item.name} (x{item.quantity}) {item.note && `- ${item.note}`}</span>
                        <div style={styles.itemActions}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateEditItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            style={styles.quantityInput}
                          />
                          <input
                            type="text"
                            placeholder="Ghi chu"
                            value={item.note}
                            onChange={(e) => updateEditItem(index, 'note', e.target.value)}
                            style={styles.noteInput}
                          />
                          <button
                            style={styles.removeButton}
                            onClick={() => removeEditItem(index)}
                          >
                            Xoa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={styles.actions}>
                    <button style={styles.saveButton} onClick={() => saveEditOrder(order.id)}>
                      Luu
                    </button>
                    <button style={styles.cancelButton} onClick={() => setEditOrderId(null)}>
                      Huy
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={styles.orderDetails}>
                    <span>
                      #{order.id} - Ban {order.tableId}: {order.items.map(item => `${item.name} (x${item.quantity})${item.note ? ` (${item.note})` : ''} [${item.status}]`).join(', ')} - {order.status}
                    </span>
                    <div style={styles.orderMeta}>
                      <span style={styles.orderTotal}>Tong tien: {calculateOrderTotal(order).toLocaleString('vi-VN')} VND</span>
                      <span>Tao luc: {formatTimestamp(order.createdAt)}</span>
                      {order.paidAt && (
                        <span>
                          Thanh toan luc: {formatTimestamp(order.paidAt)} - Phuong thuc: {order.paymentMethod}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={styles.actions}>
                    {order.status === 'pending' && (
                      <>
                        <select
                          onChange={(e) => handlePayOrder(order.id, e.target.value)}
                          style={styles.select}
                          defaultValue=""
                        >
                          <option value="" disabled>Thanh toan</option>
                          <option value="cash">Tien mat</option>
                          <option value="card">The</option>
                        </select>
                        <button style={styles.editButton} onClick={() => startEditOrder(order)}>
                          Sua
                        </button>
                        <button
                          style={styles.completeButton}
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                        >
                          Hoan thanh
                        </button>
                        <button
                          style={styles.cancelButton}
                          onClick={() => updateOrderStatus(order.id, 'cancelled')}
                        >
                          Huy
                        </button>
                      </>
                    )}
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
                            Da phuc vu
                          </button>
                          <button
                            style={styles.cancelButton}
                            onClick={() => updateItemStatus(order.id, index, 'cancelled')}
                          >
                            Huy mon
                          </button>
                        </div>
                      )
                    ))}
                  </div>
                  {(orderHistories[order.id] && orderHistories[order.id].length > 0) && (
                    <div style={styles.history}>
                      <h5>Lich su chinh sua</h5>
                      {orderHistories[order.id].map((entry) => (
                        <div key={entry.id} style={styles.historyEntry}>
                          <span>{entry.changes}</span>
                          <span> - Boi: {entry.editedBy} - Luc: {formatTimestamp(entry.editedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  filter: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px' 
  },
  select: { 
    padding: '5px', 
    borderRadius: '4px', 
    border: '1px solid #ccc' 
  },
  orderList: { 
    marginTop: '20px' 
  },
  orderItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: '15px',
    border: '1px solid #eee',
    borderRadius: '4px',
    marginBottom: '10px',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  orderDetails: { 
    flex: '1' 
  },
  orderMeta: { 
    marginTop: '10px', 
    fontSize: '14px', 
    color: '#666', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '5px' 
  },
  orderTotal: { 
    fontWeight: 'bold', 
    color: '#28a745' 
  },
  editForm: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '10px', 
    padding: '15px', 
    backgroundColor: '#f8f9fa', 
    borderRadius: '4px' 
  },
  addItemForm: { 
    display: 'flex', 
    gap: '10px', 
    flexWrap: 'wrap' 
  },
  editItems: { 
    marginTop: '10px', 
    border: '1px solid #eee', 
    padding: '10px', 
    borderRadius: '4px' 
  },
  editItem: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '5px 0', 
    borderBottom: '1px solid #eee' 
  },
  quantityInput: { 
    padding: '5px', 
    width: '60px', 
    border: '1px solid #ccc', 
    borderRadius: '4px' 
  },
  noteInput: { 
    padding: '5px', 
    border: '1px solid #ccc', 
    borderRadius: '4px', 
    width: '150px' 
  },
  addButton: { 
    padding: '5px 10px', 
    backgroundColor: '#007bff', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer' 
  },
  removeButton: { 
    padding: '5px 10px', 
    backgroundColor: '#dc3545', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer' 
  },
  saveButton: { 
    padding: '10px', 
    backgroundColor: '#28a745', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer' 
  },
  editButton: { 
    padding: '5px 10px', 
    backgroundColor: '#007bff', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer',
    marginRight: '5px' 
  },
  completeButton: {
    padding: '5px 10px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '5px',
  },
  cancelButton: {
    padding: '5px 10px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '5px',
  },
  serveButton: {
    padding: '5px 10px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  actions: { 
    display: 'flex', 
    gap: '10px', 
    marginTop: '10px', 
    alignItems: 'center' 
  },
  itemActions: { 
    marginTop: '10px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '5px' 
  },
  itemAction: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px' 
  },
  history: { 
    marginTop: '15px', 
    padding: '10px', 
    backgroundColor: '#f8f9fa', 
    borderRadius: '4px' 
  },
  historyEntry: { 
    fontSize: '14px', 
    color: '#666', 
    marginBottom: '5px' 
  },
  error: { 
    color: 'red', 
    marginBottom: '10px' 
  },
};

export default OrderManagement;