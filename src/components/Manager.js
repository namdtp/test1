// Manager.js - Giao diện tổng thể theo MUI layout

import React from 'react';
import { AppBar, Box, Toolbar, Typography, Button, Container, Grid, Paper } from '@mui/material';
import OrderManagement from './manager/OrderManagement';
import MenuManagement from './manager/MenuManagement';
import TableManagement from './manager/TableManagement';

const Manager = () => {
  const [currentTab, setCurrentTab] = React.useState('orders');

  const renderContent = () => {
    switch (currentTab) {
      case 'menu': return <MenuManagement />;
      case 'orders': return <OrderManagement />;
      default: return <TableManagement />;
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Quản lý nhà hàng
          </Typography>
          <Button color="inherit" onClick={() => setCurrentTab('orders')}>Đơn hàng</Button>
          <Button color="inherit" onClick={() => setCurrentTab('tables')}>Bàn</Button>
          <Button color="inherit" onClick={() => setCurrentTab('menu')}>Thực đơn</Button>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          {renderContent()}
        </Paper>
      </Container>
    </Box>
  );
};

export default Manager;
