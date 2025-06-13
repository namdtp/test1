import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
  Box, Typography, TextField, Stack, Paper, Table, TableHead, TableRow, TableCell, TableBody, Button
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import vi from 'date-fns/locale/vi';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const RevenueDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [menuMap, setMenuMap] = useState({});
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch menu
  useEffect(() => {
    const fetchMenu = async () => {
      const snap = await getDocs(collection(db, 'menu'));
      const map = {};
      snap.forEach(doc => {
        const data = doc.data();
        if (data.name) map[data.name] = data;
      });
      setMenuMap(map);
    };
    fetchMenu();
  }, []);

  // Fetch orders đã thanh toán, theo ngày
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      let conds = [where('status', '==', 'complete')];
      if (fromDate) {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        conds.push(where('paidAt', '>=', start.getTime()));
      }
      if (toDate) {
        const end = new Date(toDate); end.setHours(23,59,59,999);
        conds.push(where('paidAt', '<=', end.getTime()));
      }
      const q = query(collection(db, 'orders'), ...conds, orderBy('paidAt', 'desc'));
      const snap = await getDocs(q);
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchOrders();
    // eslint-disable-next-line
  }, [fromDate, toDate]);

  // Tổng doanh thu
  const totalRevenue = useMemo(() =>
    orders.reduce((sum, order) => {
      const total = (order.items || []).filter(i => i.status !== 'cancel').reduce((s, i) => {
        const price = i.price ?? menuMap[i.name]?.price ?? 0;
        return s + (i.quantity || 0) * price;
      }, 0);
      return sum + total;
    }, 0)
  , [orders, menuMap]);

  // Tổng món đã bán
  const totalDishes = useMemo(() =>
    orders.reduce((sum, order) => {
      return sum + (order.items || []).filter(i => i.status !== 'cancel').reduce((s, i) => s + (i.quantity || 0), 0);
    }, 0)
  , [orders]);

  // Gom top món theo từng category
  const { topDishes, topFood, topDrink } = useMemo(() => {
    const stats = {}, foodStats = {}, drinkStats = {};
    orders.forEach(order => {
      (order.items || []).filter(i => i.status !== 'cancel').forEach(i => {
        const qty = i.quantity || 0;
        stats[i.name] = (stats[i.name] || 0) + qty;
        const cate = menuMap[i.name]?.category?.toLowerCase() || '';
        if (cate === 'đồ ăn') foodStats[i.name] = (foodStats[i.name] || 0) + qty;
        if (cate === 'đồ uống') drinkStats[i.name] = (drinkStats[i.name] || 0) + qty;
      });
    });
    return {
      topDishes: Object.entries(stats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty })),
      topFood: Object.entries(foodStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty })),
      topDrink: Object.entries(drinkStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty })),
    };
  }, [orders, menuMap]);

  // Biểu đồ doanh thu từng ngày
  const revenueByDay = useMemo(() => {
    const byDay = {};
    orders.forEach(order => {
      if (!order.paidAt) return;
      const day = new Date(order.paidAt).toLocaleDateString('vi-VN');
      const orderTotal = (order.items || []).filter(i => i.status !== 'cancel').reduce((sum, i) => {
        const price = i.price ?? menuMap[i.name]?.price ?? 0;
        return sum + (i.quantity || 0) * price;
      }, 0);
      if (!byDay[day]) byDay[day] = 0;
      byDay[day] += orderTotal;
    });
    return Object.entries(byDay)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => new Date(a.date.split('/').reverse().join('-')) - new Date(b.date.split('/').reverse().join('-')));
  }, [orders, menuMap]);

  // Export Excel
  const handleExport = () => {
    const rows = orders.flatMap(order =>
      (order.items || []).filter(i => i.status !== 'cancel').map(i => ({
        'Mã đơn': order.orderCode || order.id,
        'Bàn': order.tableId,
        'Ngày thanh toán': new Date(order.paidAt).toLocaleString('vi-VN'),
        'Món': i.name,
        'Danh mục': menuMap[i.name]?.category || '',
        'Số lượng': i.quantity,
        'Đơn giá': i.price ?? menuMap[i.name]?.price ?? 0,
        'Thành tiền': (i.quantity || 0) * (i.price ?? menuMap[i.name]?.price ?? 0)
      }))
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Thống kê');
    XLSX.writeFile(wb, 'doanh_thu.xlsx');
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        📊 Thống kê thu chi
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={vi}>
          <DatePicker
            label="Từ ngày"
            value={fromDate}
            onChange={setFromDate}
            slotProps={{
              textField: { size: "small", sx: { minWidth: 140 } }
            }}
            format="dd/MM/yyyy"
            clearable
          />
          <DatePicker
            label="Đến ngày"
            value={toDate}
            onChange={setToDate}
            slotProps={{
              textField: { size: "small", sx: { minWidth: 140 } }
            }}
            format="dd/MM/yyyy"
            clearable
          />
        </LocalizationProvider>
        {/* <Button variant="outlined" onClick={handleExport}>
          Xuất Excel
        </Button> */}
      </Stack>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Typography variant="body1">Tổng đơn đã thanh toán: <strong>{orders.length}</strong></Typography>
          <Typography variant="body1">Tổng doanh thu: <strong>{totalRevenue.toLocaleString('vi-VN')}₫</strong></Typography>
          <Typography variant="body1">Tổng món bán ra: <strong>{totalDishes}</strong></Typography>
        </Stack>
      </Paper>

      {/* Biểu đồ doanh thu từng ngày */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" mb={2}>Biểu đồ doanh thu theo ngày</Typography>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={revenueByDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={13} />
            <YAxis tickFormatter={v => v.toLocaleString('vi-VN')} fontSize={13} />
            <Tooltip formatter={v => v.toLocaleString('vi-VN') + '₫'} />
            <Bar dataKey="revenue" fill="#1976d2" />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* Top món bán chạy */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" mb={1}>Top 5 món bán chạy</Typography>
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell><strong>Món</strong></TableCell>
              <TableCell><strong>Số lượng bán</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topDishes.map(row => (
              <TableRow key={row.name}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.qty}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {/* --- TOP ĐỒ ĂN / ĐỒ UỐNG --- */}
        <Typography variant="subtitle1" fontWeight="bold" mb={1}>Top Đồ ăn bán chạy</Typography>
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Món</TableCell>
              <TableCell>Số lượng bán</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topFood.map(row => (
              <TableRow key={row.name}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.qty}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="subtitle1" fontWeight="bold" mb={1}>Top Đồ uống bán chạy</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Món</TableCell>
              <TableCell>Số lượng bán</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topDrink.map(row => (
              <TableRow key={row.name}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.qty}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Chi tiết từng đơn */}
      {/* {orders.map((order, idx) => {
        const orderItems = (order.items || []).filter(i => i.status !== 'cancel');
        const orderRevenue = orderItems.reduce((sum, i) => {
          const price = i.price ?? menuMap[i.name]?.price ?? 0;
          return sum + (i.quantity || 0) * price;
        }, 0);

        return (
          <Paper key={order.id} sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              🧾 Đơn hàng: {order.orderCode || order.id} • Bàn {order.tableId}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Ngày thanh toán: {new Date(order.paidAt).toLocaleString('vi-VN')}
            </Typography>
            <Typography variant="body2" gutterBottom>
              Tổng tiền đơn: <strong>{orderRevenue.toLocaleString('vi-VN')}₫</strong>
            </Typography>

            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Món</strong></TableCell>
                  <TableCell><strong>Số lượng</strong></TableCell>
                  <TableCell><strong>Đơn giá</strong></TableCell>
                  <TableCell><strong>Thành tiền</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orderItems.map((item, index) => {
                  const price = item.price ?? menuMap[item.name]?.price ?? 0;
                  return (
                    <TableRow key={index}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{price.toLocaleString('vi-VN')}₫</TableCell>
                      <TableCell>{((item.quantity || 0) * price).toLocaleString('vi-VN')}₫</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        );
      })} */}
      {loading && <Typography color="info.main" textAlign="center">Đang tải dữ liệu...</Typography>}
      {(!orders.length && !loading) && (
        <Typography color="text.secondary" textAlign="center">Không có đơn nào trong khoảng thời gian này.</Typography>
      )}
    </Box>
  );
};

export default RevenueDashboard;
