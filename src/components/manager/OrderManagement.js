import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { jsPDF } from 'jspdf';

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [error, setError] = useState('');

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
          return timeB - timeA; // mới nhất lên trước
        });
      setOrders(data);
    });
  };
  

  const fetchMenu = () => {
    onSnapshot(collection(db, 'menu'), (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setMenuItems(data);
    });
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      if (newStatus !== 'pending') {
        await updateDoc(doc(db, 'tables', orders.find(order => order.id === orderId).tableId), {
          status: 'available',
          currentOrderId: null,
          total: 0,
        });
      }
      setError('');
    } catch (err) {
      setError('Lỗi khi cập nhật trạng thái: ' + err.message);
    }
  };

  const updateItemStatus = async (orderId, itemIndex, newStatus) => {
    try {
      const order = orders.find(order => order.id === orderId);
      const updatedItems = [...order.items];
      updatedItems[itemIndex].status = newStatus;
      await updateDoc(doc(db, 'orders', orderId), { items: updatedItems });
      setError('');
    } catch (err) {
      setError('Lỗi khi cập nhật trạng thái món: ' + err.message);
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
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString();
    }
    return 'Invalid Date';
  };

  const exportOrdersToPDF = () => {
    const doc = new jsPDF();
  
    // Tiêu đề
    doc.setFontSize(18);
    doc.text('Danh sách đơn hàng', 14, 20);
  
    // Cấu hình style cho nội dung
    doc.setFontSize(12);
    let yOffset = 30; // Offset cho dòng đầu tiên
  
    filteredOrders.forEach((order) => {
      doc.text(`#${order.id} - Bàn ${order.tableId}`, 14, yOffset);
      yOffset += 6;
  
      order.items.forEach((item) => {
        const itemText = `${item.name} (x${item.quantity})${item.note ? ` (${item.note})` : ''} [${item.status}]`;
        doc.text(itemText, 14, yOffset);
        yOffset += 6;
      });
  
      const total = `Tổng tiền: ${calculateOrderTotal(order).toLocaleString("vi-VN")} ₫`;
      doc.text(total, 14, yOffset);
      yOffset += 6;
  
      const createdAt = `Tạo lúc: ${formatTimestamp(order.createdAt)}`;
      doc.text(createdAt, 14, yOffset);
      yOffset += 6;
  
      if (order.paidAt) {
        const paidAt = `Thanh toán lúc: ${formatTimestamp(order.paidAt)} - Phương thức: ${order.paymentMethod}`;
        doc.text(paidAt, 14, yOffset);
        yOffset += 6;
      }
  
      yOffset += 6; // Khoảng cách giữa các đơn hàng
    });
  
    // Lưu file PDF
    doc.save(`orders_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div>
      <h3>Quản lý Order</h3>

      <div style={styles.filter}>
        <label>Lọc theo trạng thái: </label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={styles.select}
        >
          <option value="All">Tất cả</option>
          <option value="pending">Đang chờ</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>

      <h4>Danh sách đơn hàng</h4>
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.orderList}>
        {filteredOrders.length === 0 ? (
          <p>Chưa có đơn hàng nào.</p>
        ) : (
            filteredOrders.map((order) => (
                <div key={order.id} style={styles.orderItem}>
                  <div>
                    <span>
                      #{order.id} - Bàn {order.tableId}:{" "}
                      {order.items
                        .map(
                          (item) =>
                            `${item.name} (x${item.quantity})${
                              item.note ? ` (${item.note})` : ""
                            } [${item.status}]`
                        )
                        .join(", ")}{" "}
                      - {order.status}
                    </span>
                    <div style={styles.orderMeta}>
                      <span style={styles.orderTotal}>
                        Tổng tiền: {calculateOrderTotal(order).toLocaleString("vi-VN")} ₫
                      </span>
                      <span>Tạo lúc: {formatTimestamp(order.createdAt)}</span>
                      {order.paidAt && (
                        <span>
                          Thanh toán lúc: {formatTimestamp(order.paidAt)} - Phương thức:{" "}
                          {order.paymentMethod}
                        </span>
                      )}
                    </div>
                  </div>
                  {order.status === "pending" && (
                    <div style={styles.actions}>
                      <button
                        style={styles.completeButton}
                        onClick={() => updateOrderStatus(order.id, "completed")}
                      >
                        Hoàn thành
                      </button>
                      <button
                        style={styles.cancelButton}
                        onClick={() => updateOrderStatus(order.id, "cancelled")}
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                  <div style={styles.itemActions}>
                    {order.items.map(
                      (item, index) =>
                        item.status === "pending" && (
                          <div key={index} style={styles.itemAction}>
                            <span>{item.name}:</span>
                            <button
                              style={styles.serveButton}
                              onClick={() => updateItemStatus(order.id, index, "served")}
                            >
                              Đã phục vụ
                            </button>
                            <button
                              style={styles.cancelButton}
                              onClick={() => updateItemStatus(order.id, index, "cancelled")}
                            >
                              Hủy món
                            </button>
                          </div>
                        )
                    )}
                  </div>
                </div>
              ))              
        )}
      </div>
    </div>
  );
};

const styles = {
  filter: { marginBottom: '20px' },
  select: { marginLeft: '10px', padding: '5px', borderRadius: '4px' },
  orderList: { marginTop: '20px' },
  orderItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: '15px',
    border: '1px solid #eee',
    borderRadius: '4px',
    marginBottom: '10px',
    backgroundColor: '#fff',
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
  timestamp: { color: '#666', fontSize: '14px', marginTop: '5px' },
  actions: { display: 'flex', gap: '10px', marginTop: '10px' },
  itemActions: { marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' },
  itemAction: { display: 'flex', alignItems: 'center', gap: '10px' },
  completeButton: {
    padding: '5px 10px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '5px 10px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  serveButton: {
    padding: '5px 10px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  error: { color: 'red', marginBottom: '10px' },
};

export default OrderManagement;