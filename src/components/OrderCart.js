import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
  Container, Typography, Box, Button, Paper, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Snackbar, Alert, Stack, Card, CardContent
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

const OrderCart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tableId = new URLSearchParams(location.search).get('tableId');
  const cartKey = `order-cart-${tableId}`;

  const [cart, setCart] = useState([]);
  const [error, setError] = useState('');
  const [notify, setNotify] = useState({ open: false, msg: '', severity: 'success' });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    setCart(JSON.parse(localStorage.getItem(cartKey) || "[]"));
  }, [cartKey]);

  const updateQuantity = (idx, value) => {
    let qty = parseInt(value);
    if (isNaN(qty) || qty < 0) qty = 0;
  
    if (qty === 0) {
      // Xóa luôn món khỏi giỏ nếu số lượng về 0
      removeItem(idx);
    } else {
      const updated = [...cart];
      updated[idx].quantity = qty;
      setCart(updated);
      localStorage.setItem(cartKey, JSON.stringify(updated));
    }
  };
  
  
  const changeQuantity = (idx, delta) => {
    // Cho phép giảm nhỏ hơn 1
    updateQuantity(idx, (cart[idx].quantity || 0) + delta);
  };
  

  const updateNote = (idx, value) => {
    const updated = [...cart];
    updated[idx].note = value;
    setCart(updated);
    localStorage.setItem(cartKey, JSON.stringify(updated));
  };

  const removeItem = (idx) => {
    const updated = [...cart];
    updated.splice(idx, 1);
    setCart(updated);
    localStorage.setItem(cartKey, JSON.stringify(updated));
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

  const handleConfirmOrder = async () => {
    if (cart.length === 0) {
      setError('Đơn hàng trống!');
      return;
    }
    try {
      const user = auth.currentUser;
      const snapshot = await getDocs(collection(db, 'orders'));
      const existingOrder = snapshot.docs.find(doc =>
        doc.data().tableId === tableId && doc.data().status === 'pending'
      );
      const itemsWithStatus = cart.map(item => ({
        ...item,
        status: 'pending',
        timestamp: Date.now()
      }));

      if (existingOrder) {
        const docRef = doc(db, 'orders', existingOrder.id);
        const currentItems = existingOrder.data().items || [];
        const mergedItems = [
          ...currentItems,
          ...itemsWithStatus
        ];
        await updateDoc(docRef, { items: mergedItems });
        await logHistory(existingOrder.id, {
          action: 'add',
          note: `Thêm món mới vào đơn (từ giỏ hàng tạm)`,
          user: user?.email || 'staff'
        });
      } else {
        const now = new Date();
        const dateStr = now.toLocaleDateString('vi-VN').replaceAll('/', '');
        const prefix = `${dateStr}/table${tableId}`;
        const sameDayOrders = snapshot.docs.filter(doc => doc.data().orderCode?.startsWith(prefix));
        const count = sameDayOrders.length + 1;
        const orderCode = `${prefix}/${count.toString().padStart(3, '0')}`;
        const newOrder = {
          tableId,
          items: itemsWithStatus,
          status: 'pending',
          createdAt: Date.now(),
          orderCode,
          createdBy: user?.uid,
          createdByName: user?.displayName || user?.email || 'staff',
          history: []
        };
        const orderRef = await addDoc(collection(db, 'orders'), newOrder);
        await updateDoc(doc(db, 'tables', tableId), {
          status: 'occupied',
          currentOrderId: orderRef.id
        });
        await logHistory(orderRef.id, {
          action: 'add',
          note: `Tạo đơn mới (từ giỏ hàng tạm)`,
          user: user?.email || 'staff'
        });
      }
      localStorage.removeItem(cartKey);
      setCart([]);
      setNotify({ open: true, msg: 'Đã gửi đơn thành công!', severity: 'success' });
      setTimeout(() => navigate(`/staff?tableId=${tableId}`), 700);
    } catch (err) {
      setError('Lỗi khi tạo đơn: ' + err.message);
      setNotify({ open: true, msg: 'Lỗi gửi đơn!', severity: 'error' });
    }
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <Container maxWidth="sm" sx={{ pt: 3 }}>
      <Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        ← Quay lại menu
      </Button>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Đơn hàng tạm - Bàn {tableId}
      </Typography>
      <Paper elevation={3} sx={{ p: isMobile ? 1 : 2 }}>
        {cart.length === 0 ? (
          <Typography color="text.secondary">Chưa chọn món nào</Typography>
        ) : (
          isMobile ? (
            <Stack spacing={1.5}>
              {cart.map((item, i) => (
                <Card key={i} variant="outlined">
                  <CardContent sx={{ pb: '8px!important' }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography fontWeight="bold">{item.name}</Typography>
                        <Typography fontSize={13} color="text.secondary">
                          {item.price.toLocaleString('vi-VN')}₫ x
                        </Typography>
                      </Box>
                      <IconButton onClick={() => removeItem(i)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Box display="flex" alignItems="center" mt={1} gap={1}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                    <Button size="small" variant="outlined" onClick={() => changeQuantity(i, -1)} sx={{ minWidth: 32, px: 0 }}>-</Button>
                    <TextField
                        type="number"
                        value={item.quantity}
                        onChange={e => updateQuantity(i, e.target.value)}
                        size="small"
                        inputProps={{ min: 1, style: { textAlign: 'center', width: 40 } }}
                        sx={{ mx: 0.5 }}
                    />
                    <Button size="small" variant="outlined" onClick={() => changeQuantity(i, 1)} sx={{ minWidth: 32, px: 0 }}>+</Button>
                    </Stack>


                      <TextField
                        value={item.note}
                        onChange={e => updateNote(i, e.target.value)}
                        size="small"
                        label="Ghi chú"
                        sx={{ flex: 1 }}
                      />
                      <Typography fontWeight="bold" fontSize={14} color="primary" ml={1}>
                        {(item.quantity * item.price).toLocaleString('vi-VN')}₫
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tên món</TableCell>
                    <TableCell align="right">SL</TableCell>
                    <TableCell>Ghi chú</TableCell>
                    <TableCell align="right">Tổng</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                        <Button size="small" variant="outlined" onClick={() => changeQuantity(i, -1)} sx={{ minWidth: 32, px: 0 }}>-</Button>
                        <TextField
                            type="number"
                            value={item.quantity}
                            onChange={e => updateQuantity(i, e.target.value)}
                            size="small"
                            inputProps={{ min: 1, style: { textAlign: 'center', width: 40 } }}
                            sx={{ mx: 0.5 }}
                        />
                        <Button size="small" variant="outlined" onClick={() => changeQuantity(i, 1)} sx={{ minWidth: 32, px: 0 }}>+</Button>
                        </Stack>


                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.note}
                          onChange={e => updateNote(i, e.target.value)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {(item.quantity * item.price).toLocaleString('vi-VN')}₫
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={() => removeItem(i)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )
        )}
        <Box mt={2} display="flex" flexDirection={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'stretch' : 'center'} gap={2}>
          <Typography variant="h6" textAlign={isMobile ? 'center' : 'left'}>
            Tổng cộng: {totalPrice.toLocaleString('vi-VN')}₫
          </Typography>
          <Button
            fullWidth={isMobile}
            variant="contained"
            color="success"
            onClick={handleConfirmOrder}
            disabled={cart.length === 0}
            sx={{ fontSize: 16, py: 1 }}
          >
            Xác nhận đơn
          </Button>
        </Box>
        {error && <Typography color="error" mt={2}>{error}</Typography>}
      </Paper>
      {/* Snackbar thông báo */}
      <Snackbar
        open={notify.open}
        autoHideDuration={1500}
        onClose={() => setNotify({ ...notify, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setNotify({ ...notify, open: false })} severity={notify.severity} sx={{ width: '100%' }}>
          {notify.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default OrderCart;
