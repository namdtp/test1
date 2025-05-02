import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
  Container, Typography, Box, TextField, Button, Grid, Paper, IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const Order = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const tableId = new URLSearchParams(location.search).get('tableId');

  useEffect(() => {
    if (!tableId) navigate('/tables');
    fetchMenu();
  }, [tableId, navigate]);

  const fetchMenu = () => {
    onSnapshot(collection(db, 'menu'), (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setMenuItems(data);
    });
  };

  const generateOrderCode = async () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN').replaceAll('/', '');
    const prefix = `${dateStr}/table${tableId}`;

    const snapshot = await getDocs(collection(db, 'orders'));
    const sameDayOrders = snapshot.docs.filter(doc => doc.data().orderCode?.startsWith(prefix));
    const count = sameDayOrders.length + 1;
    return `${prefix}/${count.toString().padStart(3, '0')}`;
  };

  const handleAddToOrder = async () => {
    if (selectedItems.length === 0) {
      setError('Chưa chọn món để tạo đơn.');
      return;
    }

    try {
      const user = auth.currentUser;
      const snapshot = await getDocs(collection(db, 'orders'));
      const existingOrder = snapshot.docs.find(doc =>
        doc.data().tableId === tableId && doc.data().status === 'pending'
      );

      const itemsWithStatus = selectedItems.map(item => ({
        ...item,
        status: 'pending',
        timestamp: Date.now()
      }));

      if (existingOrder) {
        const docRef = doc(db, 'orders', existingOrder.id);
        const currentItems = existingOrder.data().items || [];
        const mergedItems = [...currentItems];

        itemsWithStatus.forEach(newItem => {
          const index = mergedItems.findIndex(i => i.name === newItem.name && i.status !== 'served');
          if (index !== -1) {
            mergedItems[index].quantity += newItem.quantity;
            mergedItems[index].timestamp = Date.now();
          } else {
            mergedItems.push(newItem);
          }
        });

        await updateDoc(docRef, { items: mergedItems });

      } else {
        const orderCode = await generateOrderCode();
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
      }

      setSelectedItems([]);
      navigate(`/staff?tableId=${tableId}`);
    } catch (err) {
      setError('Lỗi khi tạo đơn: ' + err.message);
    }
  };

  const addItem = (item) => {
    const exists = selectedItems.findIndex(i => i.name === item.name);
    if (exists !== -1) {
      const updated = [...selectedItems];
      updated[exists].quantity += 1;
      setSelectedItems(updated);
    } else {
      setSelectedItems([...selectedItems, {
        name: item.name,
        quantity: 1,
        note: ''
      }]);
    }
    setError('');
  };

  const updateNote = (index, value) => {
    const updated = [...selectedItems];
    updated[index].note = value;
    setSelectedItems(updated);
  };

  const updateQuantity = (index, value) => {
    const updated = [...selectedItems];
    updated[index].quantity = Math.max(1, parseInt(value) || 1);
    setSelectedItems(updated);
  };

  const removeItem = (index) => {
    const updated = [...selectedItems];
    updated.splice(index, 1);
    setSelectedItems(updated);
  };

  const filteredMenu = menuItems.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Container maxWidth="lg" sx={{ pt: 4 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Tạo đơn hàng - Bàn {tableId}
      </Typography>
      <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        ← Quay lại
      </Button>
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <TextField
            fullWidth
            label="Tìm kiếm món"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            {filteredMenu.map((item, index) => (
              <Grid item xs={6} sm={4} key={index}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => addItem(item)}
                  sx={{ justifyContent: 'space-between', height: 60 }}
                >
                  <span>{item.name}</span>
                  <span>{item.price.toLocaleString('vi-VN')}₫</span>
                </Button>
              </Grid>
            ))}
          </Grid>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Món đã chọn
            </Typography>
            {selectedItems.length === 0 ? (
              <Typography color="text.secondary">Chưa chọn món nào</Typography>
            ) : (
              selectedItems.map((item, i) => (
                <Box key={i} display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography flex={1}>{item.name}</Typography>
                  <TextField
                    label="SL"
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(i, e.target.value)}
                    size="small"
                    sx={{ width: 70 }}
                  />
                  <TextField
                    label="Ghi chú"
                    value={item.note}
                    onChange={(e) => updateNote(i, e.target.value)}
                    size="small"
                    sx={{ flex: 2 }}
                  />
                  <IconButton onClick={() => removeItem(i)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))
            )}
            <Button
              fullWidth
              variant="contained"
              color="success"
              sx={{ mt: 2 }}
              onClick={handleAddToOrder}
              disabled={selectedItems.length === 0}
            >
              Xác nhận tạo đơn hàng
            </Button>
            {error && <Typography color="error" mt={2}>{error}</Typography>}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Order;
