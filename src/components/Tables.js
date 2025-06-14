import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import {
  Typography, Grid, Paper, Button, Box, Divider
} from '@mui/material';

import './Tables.css';

const getOrderTotal = (order, menuMap) => {
  return (order.items || [])
    .filter(item => item.status !== 'cancel')
    .reduce((sum, item) => {
      // Ưu tiên item.price (giá đã fix khi thêm món), fallback sang menuMap, cuối cùng là 0
      const price = item.price ?? menuMap[item.name]?.price ?? 0;
      return sum + (item.quantity || 0) * price;
    }, 0);
};

const Tables = () => {
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuMap, setMenuMap] = useState({});
  const [userRole, setUserRole] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTables(data);
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });

    const unsubMenu = onSnapshot(collection(db, 'menu'), (snapshot) => {
      const map = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name) map[data.name] = data;
      });
      setMenuMap(map);
    });

    return () => {
      unsubTables();
      unsubOrders();
      unsubMenu();
    };
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role || '');
        }
      }
    };
    fetchUser();
  }, []);

  const handleSelectTable = (tableId) => {
    navigate(`/staff?tableId=${tableId}`);
  };

  // Tính thông tin đơn hàng đang pending của bàn
  const getOrderInfo = (tableId) => {
    const order = orders.find(o => o.tableId === tableId && o.status === 'pending');
    if (!order) return null;

    const itemCount = (order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    const total = getOrderTotal(order, menuMap);
    return {
      createdAt: order.createdAt,
      itemCount,
      total
    };
  };

  // Gom bàn theo hàng (row)
  const groupedByRow = useMemo(() => (
    tables.reduce((acc, table) => {
      const row = (table.row || 'Khác').toUpperCase();
      if (!acc[row]) acc[row] = [];
      acc[row].push(table);
      return acc;
    }, {})
  ), [tables]);

  const sortedRowKeys = useMemo(() => Object.keys(groupedByRow).sort(), [groupedByRow]);

  return (
    <Box sx={{ p: 2, maxWidth: '1200px', mx: 'auto' }}>
      <Box className="tables-header" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h5" fontWeight="bold">Chọn bàn</Typography>
        {userRole === 'manager' && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/manager')}
            sx={{ mt: { xs: 1, sm: 0 } }}
          >
            ← Quay về quản lý
          </Button>
        )}
      </Box>

      {sortedRowKeys.map((rowKey) => (
        <Box key={rowKey} sx={{ mt: 4 }}>
          <Typography variant="subtitle1" fontWeight="bold" className="table-row-label">
            Hàng {rowKey}
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2}>
            {groupedByRow[rowKey]
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map((table) => {
                const info = getOrderInfo(table.id);
                const isOccupied = table.status === 'occupied';

                return (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={table.id}>
                    <Paper
                      className={`table-card ${isOccupied ? 'occupied' : 'available'}`}
                      onClick={() => handleSelectTable(table.id)}
                      elevation={1}
                      sx={{
                        cursor: 'pointer',
                        p: 2,
                        minHeight: 140,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        border: isOccupied ? '2px solid #ff9800' : '2px solid #bdbdbd',
                        boxShadow: isOccupied ? 3 : 1,
                        transition: 'box-shadow 0.2s'
                      }}
                    >
                      <Typography className="table-name" fontWeight={700} fontSize={22} gutterBottom>
                        {table.name || table.id}
                      </Typography>
                      {isOccupied && info ? (
                        <>
                          <Typography className="table-time" fontSize={13} color="text.secondary">
                            Thời gian: {info.createdAt ? new Date(info.createdAt).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            }) : ''}
                          </Typography>
                          <div className="table-divider" style={{ margin: '6px 0' }} />
                          <Typography className="table-label" fontSize={16}>
                            Số món: <strong>{info.itemCount}</strong>
                          </Typography>
                          <Typography className="table-label" fontSize={16}>
                            Tổng tiền: <strong>{info.total.toLocaleString('vi-VN')}₫</strong>
                          </Typography>
                        </>
                      ) : (
                        <Typography className="table-text" color="text.secondary" fontSize={16}>
                          Trống
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                );
              })}
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default Tables;
