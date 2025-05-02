import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import {
  Box, Typography, Button, IconButton, TextField, Stack
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import EditIcon from '@mui/icons-material/Edit';
import './Staff.css';


const Staff = () => {
  const [orders, setOrders] = useState([]);
  const [menuMap, setMenuMap] = useState({});
  const [userEmail, setUserEmail] = useState('');
  const [editItems, setEditItems] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const tableId = new URLSearchParams(location.search).get('tableId');

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) navigate('/login');
    });

    if (!tableId) navigate('/tables');
    fetchOrders();
    fetchUserEmail();
    fetchMenu();

    const interval = setInterval(() => {
      fetchOrders();
      fetchMenu();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [tableId, navigate]);

  const fetchOrders = () => {
    onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(order => order.tableId === tableId && order.status === 'pending');
      setOrders(data);
    });
  };

  const fetchMenu = () => {
    onSnapshot(collection(db, 'menu'), (snapshot) => {
      const map = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.name) map[data.name] = data;
      });
      setMenuMap(map);
    });
  };

  const fetchUserEmail = async () => {
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) setUserEmail(userDoc.data().email);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const goToOrderPage = () => {
    navigate(`/order?tableId=${tableId}`);
  };

  const goBackToTables = () => {
    navigate('/tables');
  };

  const getDynamicStatus = (item) => {
    if (item.status === 'served') return 'served';
    if (item.status === 'cancel') return 'cancel';
    const now = Date.now();
    const createdTime = parseInt(item.timestamp);
    const elapsedMin = (now - createdTime) / 60000;
    if (elapsedMin > 30) return 'late';
    if (elapsedMin > 5) return 'pending';
    return 'new';
  };

  const renderStatus = (item) => {
    const status = getDynamicStatus(item);
    const map = {
      new: 'status-new',
      pending: 'status-pending',
      late: 'status-late',
      served: 'status-done',
      cancel: 'status-cancel',
    };
    const labelMap = {
      new: 'Mới',
      pending: 'Đang chờ',
      late: 'Quá lâu',
      served: 'Đã phục vụ',
      cancel: 'Hủy',
    };
    return <span className={`status-chip ${map[status] || 'status-pending'}`}>{labelMap[status]}</span>;
  };

  const formatOrderCode = (order, index) => {
    const date = new Date(order.createdAt || order.items[0]?.timestamp || Date.now());
    const dateStr = date.toLocaleDateString('vi-VN').replaceAll('/', '');
    return `${dateStr}/table${order.tableId}/${(index + 1).toString().padStart(3, '0')}`;
  };

  const handleQuantityChange = (orderId, index, value) => {
    setEditItems(prev => ({
      ...prev,
      [`${orderId}-${index}`]: {
        ...prev[`${orderId}-${index}`],
        quantity: Math.max(1, parseInt(value) || 1)
      }
    }));
  };

  const handleNoteChange = (orderId, index, value) => {
    setEditItems(prev => ({
      ...prev,
      [`${orderId}-${index}`]: {
        ...prev[`${orderId}-${index}`],
        note: value
      }
    }));
  };

  const logHistory = async (orderId, entry) => {
    const orderRef = doc(db, 'orders', orderId);
    const snapshot = await getDoc(orderRef);
    const currentHistory = snapshot.data()?.history || [];
    await updateDoc(orderRef, {
      history: [
        ...currentHistory,
        {
          ...entry,
          timestamp: Date.now()
        }
      ]
    });
  };

  const handleSaveItemEdit = async (order, index) => {
    const key = `${order.id}-${index}`;
    const changes = editItems[key];
    if (!changes) return;

    const updatedOrder = { ...order };
    updatedOrder.items[index].quantity = changes.quantity;
    updatedOrder.items[index].note = changes.note;

    await updateDoc(doc(db, 'orders', order.id), {
      items: updatedOrder.items
    });

    await logHistory(order.id, {
      action: 'edit',
      item: updatedOrder.items[index].name,
      user: userEmail
    });

    setEditItems(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1000px', mx: 'auto' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        mb={2}
      >
        <Box>
          <Typography variant="h5" fontWeight="bold">Bàn {tableId || 'X'}</Typography>
          {orders.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              Mã đơn: {formatOrderCode(orders[0], 0)} - Trạng thái: <strong>{orders[0].status}</strong>
            </Typography>
          )}
        </Box>
        <IconButton onClick={handleLogout} color="error">
          <LogoutIcon />
        </IconButton>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} mb={2}>
        <Button variant="outlined" onClick={goBackToTables} fullWidth={true}>
          ← Quay về
        </Button>
        <Button variant="contained" color="warning" onClick={goToOrderPage} fullWidth={true}>
          ➕ Thêm món mới
        </Button>
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <table className="staff-table">
          <thead>
            <tr>
              <th>MÓN</th>
              <th>LOẠI</th>
              <th>TRẠNG THÁI</th>
              <th>SỐ LƯỢNG</th>
              <th>THỜI GIAN / GHI CHÚ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.flatMap((order, oIdx) =>
              order.items.map((item, index) => {
                const editKey = `${order.id}-${index}`;
                const isEditing = editItems[editKey] !== undefined;

                return (
                  <tr key={editKey}>
                    <td>{item.name || '---'}</td>
                    <td>{menuMap[item.name]?.category || '---'}</td>
                    <td>{renderStatus(item)}</td>
                    <td>
                      {isEditing && item.status !== 'served' && item.status !== 'cancel' ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editItems[editKey]?.quantity || item.quantity}
                          onChange={(e) => handleQuantityChange(order.id, index, e.target.value)}
                          sx={{ width: 70 }}
                        />
                      ) : (
                        item.quantity
                      )}
                    </td>
                    <td>
                      {isEditing && item.status !== 'served' && item.status !== 'cancel' ? (
                        <TextField
                          size="small"
                          value={editItems[editKey]?.note || item.note || ''}
                          onChange={(e) => handleNoteChange(order.id, index, e.target.value)}
                          fullWidth
                        />
                      ) : (
                        item.note || new Date(parseInt(item.timestamp)).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      )}
                    </td>
                    <td>
                      {order.status === 'pending' && item.status !== 'served' && item.status !== 'cancel' && (
                        isEditing ? (
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="outlined" color="success" onClick={() => handleSaveItemEdit(order, index)}>
                              Lưu
                            </Button>
                            <Button size="small" variant="outlined" color="inherit" onClick={() => setEditItems(prev => {
                              const copy = { ...prev };
                              delete copy[editKey];
                              return copy;
                            })}>
                              Hủy
                            </Button>
                          </Stack>
                        ) : (
                          <IconButton className="action-icon" size="small" onClick={() => {
                            setEditItems(prev => ({
                              ...prev,
                              [editKey]: {
                                quantity: item.quantity,
                                note: item.note || ''
                              }
                            }));
                          }}>
                            <EditIcon fontSize="inherit" />
                          </IconButton>
                        )
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Box>
    </Box>
  );
};

export default Staff;
