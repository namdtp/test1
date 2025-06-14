// Manager.js - Giao diện tổng thể theo MUI layout

import React from 'react';
import { AppBar, Box, Toolbar, Typography, Button, Container, Paper } from '@mui/material';
import OrderManagement from './manager/OrderManagement';
// import MenuManagement from './manager/MenuManagement';
import TableManagement from './manager/TableManagement';
// import RevenueDashboard from './manager/RevenueDashboard';
import UserManagement from './manager/UserManagement'
import Logs from './manager/Logs';


const Manager = () => {
  const [currentTab, setCurrentTab] = React.useState('orders');

  const renderContent = () => {
    switch (currentTab) {
      // case 'menu': return <MenuManagement />;
      case 'orders': return <OrderManagement />;
      // case 'revenue': return <RevenueDashboard />;
      case 'users': return <UserManagement />;
      case 'logs': return <Logs />;
      default: return <TableManagement />;
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
              
          </Typography>
          <Button color="inherit" onClick={() => setCurrentTab('orders')}>Đơn hàng</Button>
          <Button color="inherit" onClick={() => setCurrentTab('logs')}>Logs</Button>
          <Button color="inherit" onClick={() => setCurrentTab('tables')}>Bàn</Button>
          {/* <Button color="inherit" onClick={() => setCurrentTab('menu')}>Thực đơn</Button> */}
          <Button color="inherit" onClick={() => setCurrentTab('users')}>Nhân viên</Button>
          {/* <Button color="inherit" onClick={() => setCurrentTab('revenue')}>Thống kê</Button> */}
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
