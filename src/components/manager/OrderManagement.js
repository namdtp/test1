import React, { useEffect, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
  Box,
  Stack,
  TextField
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { printBill } from './printBill';


import './OrderManagement.css';

const statusColor = {
  pending: 'warning',
  served: 'success',
  cancel: 'default',
  complete: 'success'
};



const OrderManagement = () => {
  const [menuMap, setMenuMap] = useState({});
  const [orders, setOrders] = useState([]);
  const [userMap, setUserMap] = useState({});
  const navigate = useNavigate();
  const [cashInput, setCashInput] = useState({});

  const handleItemStatusToggle = async (orderId, itemIndex) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
  
    const updatedItems = [...order.items];
    const currentStatus = updatedItems[itemIndex].status;
  
    if (currentStatus === 'pending') {
      updatedItems[itemIndex].status = 'served';
      await updateDoc(doc(db, 'orders', orderId), { items: updatedItems });
    }
  };
  

  const handleCashChange = (orderId, value) => {
    setCashInput(prev => ({
      ...prev,
      [orderId]: parseInt(value) || 0
    }));
  };


  useEffect(() => {
    const unsubMenu = onSnapshot(collection(db, 'menu'), (snapshot) => {
      const map = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.name) map[data.name] = data;
      });
      setMenuMap(map);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const map = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        map[doc.id] = data.name || data.email || doc.id;
      });
      setUserMap(map);
    });

        
    
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const sorted = data.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setOrders(sorted);
    });

    return () => {
      unsubMenu();
      unsubUsers();
      unsubOrders();
    };
  }, []);

  const calculateTotal = (items) => {
    return (items || [])
      .filter(item => item.status !== 'cancel')
      .reduce((total, item) => {
        const price = menuMap[item.name]?.price || 0;
        return total + price * (item.quantity || 0);
      }, 0);
  };

  const calculateChange = (orderId, items) => {
    const total = calculateTotal(items);
    const cash = cashInput[orderId] || 0;
    return cash > total ? cash - total : 0;
  };
  

  const logHistory = async (orderId, entry) => {
    const order = orders.find(o => o.id === orderId);
    const currentHistory = order?.history || [];
    await updateDoc(doc(db, 'orders', orderId), {
      history: [
        ...currentHistory,
        {
          ...entry,
          timestamp: Date.now()
        }
      ]
    });
  };

  const handleQuantityChange = async (orderId, index, value) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const updatedItems = [...order.items];
    updatedItems[index].quantity = Math.max(1, parseInt(value));
    await updateDoc(doc(db, 'orders', orderId), { items: updatedItems });
  };

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Danh sách đơn hàng (mới nhất ở trên)
      </Typography>

      <Button
        variant="contained"
        color="primary"
        sx={{ mb: 2 }}
        onClick={() => navigate('/tables')}
      >
        ➕ Tạo đơn hàng mới
      </Button>

      {orders.map((order) => (
        <Accordion key={order.id} defaultExpanded={false}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <div className="order-summary">
              <Typography sx={{ flex: 1 }}>
                🧾 {order.orderCode || order.id} | Bàn {order.tableId} | {order.items?.length || 0} món
              </Typography>
              <Chip
                label={order.status}
                color={statusColor[order.status] || 'default'}
                size="small"
                className="order-chip"
              />
              <Typography variant="caption">
                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit'
                }) : '---'}
              </Typography>
            </div>
          </AccordionSummary>

          <AccordionDetails>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>MÓN</strong></TableCell>
                    <TableCell><strong>SỐ LƯỢNG</strong></TableCell>
                    <TableCell><strong>GIÁ</strong></TableCell>
                    <TableCell><strong>TRẠNG THÁI / HỦY</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.items?.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.name}</TableCell>

                      <TableCell>
                        {item.status === 'pending' ? (
                          <TextField
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(order.id, idx, e.target.value)}
                            size="small"
                            sx={{ width: 70 }}
                          />
                        ) : (
                          item.quantity
                        )}
                      </TableCell>

                      <TableCell>
                        {menuMap[item.name]?.price !== undefined
                          ? `${menuMap[item.name].price.toLocaleString('vi-VN')}₫`
                          : '---'}
                      </TableCell>

                      <TableCell>
                        <Stack direction="row" spacing={1}>
                        <Chip
                          label={{
                            new: 'Mới',
                            pending: 'Đang chờ',
                            late: 'Quá lâu',
                            served: 'Đã phục vụ',
                            cancel: 'Hủy',
                          }[item.status] || item.status}
                          size="small"
                          color={{
                            new: 'primary',
                            pending: 'warning',
                            late: 'error',
                            served: 'success',
                            cancel: 'default',
                          }[item.status] || 'default'}
                          sx={{
                            cursor: (item.status === 'pending' && order.status !== 'complete') ? 'pointer' : 'default',
                            opacity: (order.status === 'complete') ? 0.7 : 1
                          }}
                          onClick={() => {
                            if (item.status === 'pending' && order.status !== 'complete') {
                              handleItemStatusToggle(order.id, idx);
                            }
                          }}
                        />


                          {item.status === 'pending' && (
                            <Button
                              color="error"
                              size="small"
                              variant="outlined"
                              onClick={async () => {
                                const updatedItems = [...order.items];
                                updatedItems[idx].status = 'cancel';
                                await updateDoc(doc(db, 'orders', order.id), { items: updatedItems });
                              }}
                            >
                              Hủy
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              🧮 Tổng tiền: {calculateTotal(order.items || []).toLocaleString('vi-VN')}₫
            </Typography>
            <Typography variant="body2" color="text.secondary">
              👤 Người tạo: {userMap[order.createdBy] || '---'}
            </Typography>
            {order.paidAt && (
              <Typography variant="body2" color="text.secondary">
                💰 Thanh toán lúc: {new Date(order.paidAt).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })}
              </Typography>
            )}

            {order.history?.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2 }}>📝 Lịch sử đơn hàng:</Typography>
                <ul className="order-history">
                  {order.history.map((log, i) => (
                    <li key={i}>
                      [{new Date(log.timestamp).toLocaleString('vi-VN')}] {log.user || '---'}: {log.action} {log.item || ''}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                label="Tiền khách đưa (VND)"
                type="number"
                size="small"
                value={cashInput[order.id] || ''}
                onChange={(e) => handleCashChange(order.id, e.target.value)}
                sx={{ width: 200 }}
              />
              <Typography variant="body2">
                💵 Tiền thối lại: <strong>{calculateChange(order.id, order.items).toLocaleString('vi-VN')}₫</strong>
              </Typography>
            </Box>


            <Button
              variant="outlined"
              color="secondary"
              size="small"
              sx={{ mt: 2, mr: 2 }}
              onClick={() => printBill(order, menuMap)}
            >
              🖨 In bill
            </Button>


            <Button
              variant="contained"
              color="success"
              size="small"
              sx={{ mt: 2 }}
              disabled={order.items.some(item => item.status === 'pending') || order.status === 'complete'}
              onClick={async () => {
                const orderRef = doc(db, 'orders', order.id);
                await updateDoc(orderRef, {
                  status: 'complete',
                  paidAt: Date.now()
                });
                await logHistory(order.id, {
                  action: 'complete',
                  user: userMap[order.createdBy] || '---'
                });
                await updateDoc(doc(db, 'tables', order.tableId), {
                  status: 'available',
                  currentOrderId: null
                });
              }}
            >
              {order.status === 'complete' ? 'Đã thanh toán' : '✅ Thanh toán'}
            </Button>
          </AccordionDetails>
        </Accordion>
      ))}
    </>
  );
};

export default OrderManagement;
