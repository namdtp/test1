import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container, Typography, Box, TextField, Button, Paper, Stack, Divider, Snackbar, Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useMenu } from '../contexts/MenuContext';

const removeVietnameseTones = (str) => {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

const groupByCategory = (items) => {
  const grouped = {};
  items.forEach((item) => {
    const cat = item.category || 'Khác';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  return grouped;
};

const Order = () => {
  const menuItems = useMenu();  // LẤY MENU TỪ CONTEXT
  const [search, setSearch] = useState('');
  const [notify, setNotify] = useState({ open: false, msg: '' });
  const navigate = useNavigate();
  const location = useLocation();
  const tableId = new URLSearchParams(location.search).get('tableId');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Lấy giỏ hàng tạm từ localStorage
  const cartKey = `order-cart-${tableId}`;
  const getCart = () => JSON.parse(localStorage.getItem(cartKey) || "[]");
  const cartCount = getCart().reduce((sum, item) => sum + item.quantity, 0);

  // Nếu chưa có tableId, chuyển hướng về /tables
  React.useEffect(() => {
    if (!tableId) navigate('/tables');
    // eslint-disable-next-line
  }, [tableId, navigate]);

  // KHÔNG CẦN fetchMenu và useEffect nào cho menu nữa!

  const addItemToCart = (item) => {
    const prevCart = getCart();
    localStorage.setItem(cartKey, JSON.stringify([
      ...prevCart,
      { name: item.name, quantity: 1, note: '', price: item.price }
    ]));
    setNotify({ open: true, msg: `Đã thêm "${item.name}" vào đơn tạm!` });
  };

  // Filter và group menu
  const filteredMenu = menuItems.filter(item =>
    removeVietnameseTones(item.name.toLowerCase()).includes(removeVietnameseTones(search.toLowerCase()))
  );

  const groupedMenu = groupByCategory(filteredMenu);

  return (
    <Container maxWidth="lg" sx={{ pt: 3, pb: { xs: 10, sm: 7 }}}>
      <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        ← Quay lại
      </Button>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Gọi món - Bàn {tableId}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 3,
        }}
      >
        {/* Menu chọn món */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            mb: isMobile ? 0 : 3,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <TextField
            fullWidth
            label="Tìm kiếm món"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Paper
            elevation={2}
            sx={{
              p: 2,
              flex: 1,
              overflowY: 'auto'
            }}
          >
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Danh sách món ăn
            </Typography>
            {Object.entries(groupedMenu).map(([category, items]) => (
              <Box key={category} mb={2}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  {category}
                </Typography>
                <Stack spacing={1}>
                  {items.map((item, index) => (
                    <Box
                      key={index}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      py={1}
                      borderBottom="1px solid #f0f0f0"
                    >
                      <Box>
                        <Typography fontWeight="bold">{item.name}</Typography>
                        <Typography fontSize={13} color="text.secondary">{item.price.toLocaleString('vi-VN')}₫</Typography>
                      </Box>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => addItemToCart(item)}
                        sx={{
                          minWidth: 64,
                          px: 1.5,
                          fontSize: 14
                        }}
                      >
                        Thêm
                      </Button>
                    </Box>
                  ))}
                </Stack>
                <Divider sx={{ my: 1 }} />
              </Box>
            ))}
          </Paper>
        </Box>
      </Box>

      {/* Nút nổi chuyển sang giỏ hàng tạm */}
      <Button
  variant="contained"
  sx={{
    position: 'fixed',
    left: { xs: 8, sm: 'auto' },
    right: { xs: 8, sm: 24 },
    bottom: { xs: 16, sm: 24 },
    width: { xs: 'calc(100vw - 32px)', sm: 'auto' },
    maxWidth: 400,
    zIndex: 1400,
    borderRadius: { xs: 2, sm: '50px' },
    fontSize: { xs: 18, sm: 16 },
    py: { xs: 2, sm: 1 }
  }}
  onClick={() => navigate(`/order/cart?tableId=${tableId}`)}
>
  Đơn hàng tạm ({cartCount})
</Button>


      {/* Snackbar thông báo thêm món */}
      <Snackbar
        open={notify.open}
        autoHideDuration={1200}
        onClose={() => setNotify({ ...notify, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setNotify({ ...notify, open: false })} severity="success" sx={{ width: '100%' }}>
          {notify.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Order;
