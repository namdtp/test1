import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Stack, Divider
} from '@mui/material';
import './Staff.css'; // dùng chung style với staff

const Kitchen = () => {
  const [orders, setOrders] = useState([]);
  const [menuMap, setMenuMap] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(order => order.status === 'pending')
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setOrders(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubMenu = onSnapshot(collection(db, 'menu'), (snapshot) => {
      const map = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name) map[data.name] = data;
      });
      setMenuMap(map);
    });
    return () => unsubMenu();
  }, []);

  const updateItemStatus = async (orderId, index, status) => {
    const orderRef = doc(db, 'orders', orderId);
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const updatedItems = [...order.items];
    updatedItems[index].status = status;
    await updateDoc(orderRef, { items: updatedItems });
  };

  const getDynamicStatus = (item) => {
    if (item.status === 'served') return 'served';
    if (item.status === 'cancel') return 'cancel';
    const now = Date.now();
    const createdTime = parseInt(item.timestamp);
    const elapsedMin = (now - createdTime) / 60000;
    if (elapsedMin > 15) return 'late';
    return 'pending';
  };

  const totalPendingItems = orders.reduce((sum, order) =>
    sum + order.items.filter(item =>
      item.status === 'pending' &&
      (menuMap[item.name]?.category || '').toLowerCase() === 'đồ ăn'
    ).length
  , 0);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1200px', mx: 'auto' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🧑‍🍳 Đơn hàng đang chờ bếp ({totalPendingItems} món chờ)
      </Typography>

      {orders.map((order) => (
        <Paper
          key={order.id}
          elevation={3}
          sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 2 }}
        >
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Đơn: {order.orderCode || order.id} • Bàn {order.tableId}
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Món</strong></TableCell>
                  <TableCell><strong>Số lượng</strong></TableCell>
                  <TableCell><strong>Ghi chú</strong></TableCell>
                  <TableCell><strong>Thời gian</strong></TableCell>
                  <TableCell><strong>Trạng thái</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.items
                  .filter(item => (menuMap[item.name]?.category || '').toLowerCase() === 'đồ ăn')
                  .map((item, idx) => {
                    const status = getDynamicStatus(item);
                    return (
                      <TableRow key={idx}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.note || '-'}</TableCell>
                        <TableCell>
                          {item.timestamp
                            ? new Date(item.timestamp).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '---'}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <span
                              className={`status-chip status-${status}`}
                              onClick={item.status === 'pending'
                                ? () => updateItemStatus(order.id, idx, 'served')
                                : undefined
                              }
                              style={{ cursor: item.status === 'pending' ? 'pointer' : 'default' }}
                            >
                              {status === 'pending' ? 'Đang chờ'
                                : status === 'late' ? 'Quá lâu'
                                : status === 'served' ? 'Đã xong'
                                : 'Đã huỷ'}
                            </span>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default Kitchen;
