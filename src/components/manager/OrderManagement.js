import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, updateDoc, doc, getDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import {
  Box, Typography, Accordion, AccordionSummary, AccordionDetails, Chip,
  Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Stack, Divider, TextField, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PrintIcon from '@mui/icons-material/Print';
import RestoreIcon from '@mui/icons-material/Restore';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

// DATE PICKER FILTER
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import vi from 'date-fns/locale/vi';
// import { printBill } from './printBill';

// MenuContext
import { useMenu } from '../../contexts/MenuContext';

const statusColor = {
  pending: 'warning',
  served: 'success',
  cancel: 'default',
  complete: 'success'
};

function getOrderTotal(order, menuMap) {
  return (order.items || [])
    .filter(item => item.status !== 'cancel')
    .reduce((sum, item) => sum + (item.quantity * (menuMap[item.name]?.price || item.price || 0)), 0);
}

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [tableFilter, setTableFilter] = useState('all');
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [dateFilter, setDateFilter] = useState(null);
  const [noteDialog, setNoteDialog] = useState({ open: false, value: '', orderId: '', itemIdx: -1 });
  const [historyDialog, setHistoryDialog] = useState({ open: false, order: null });
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  // Dialog chỉnh bill trước khi in
  const [billDialog, setBillDialog] = useState({
    open: false,
    order: null,
    customerName: '',
    discount: 0,
    note: '',
    extraFee: 0,
    itemsBill: []
  });

  const printToLAN = (billData, printer = 'bar') => {
  fetch('http://192.168.1.200:3000/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...billData, printer })
  })
    .then(res => res.json())
    .then(data => {
      setSnack({
        open: true,
        msg: data.status === 'ok'
          ? `Đã gửi lệnh in ra máy in ${printer === 'bar' ? 'BAR' : 'BẾP'}!`
          : 'Lỗi in bill',
        severity: data.status === 'ok' ? 'success' : 'error'
      });
    })
    .catch(() =>
      setSnack({
        open: true,
        msg: 'Không kết nối được máy in LAN!',
        severity: 'error'
      })
    );
  setBillDialog({ open: false, order: null });
};

  // Responsive
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Lấy menuList qua context
  const menuList = useMenu();

  // Tạo menuMap từ menuList
  const menuMap = useMemo(() => {
    const map = {};
    menuList.forEach(m => { map[m.name] = m; });
    return map;
  }, [menuList]);

  // Tạo query lọc theo ngày bằng createdAt (timestamp)
  useEffect(() => {
    let orderQuery = collection(db, 'orders');
    const conds = [];
    if (statusFilter !== 'all') conds.push(where('status', '==', statusFilter));
    if (dateFilter) {
      // Lấy đầu ngày & cuối ngày của dateFilter (timestamp ms)
      const start = new Date(dateFilter);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateFilter);
      end.setHours(23, 59, 59, 999);
      conds.push(where('createdAt', '>=', start.getTime()));
      conds.push(where('createdAt', '<=', end.getTime()));
    }
    orderQuery = query(orderQuery, ...conds, orderBy('createdAt', 'desc'), limit(100));

    const unsubOrders = onSnapshot(orderQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubOrders();
  }, [statusFilter, dateFilter]);

  // Lấy user hiện tại cho mọi thao tác
  const getUsername = () => {
    const user = auth.currentUser;
    return user?.displayName || user?.email || 'staff';
  };

  // Filter tableIds
  const tableIds = Array.from(new Set(orders.map(o => o.tableId)));
  const filteredOrders = orders
    .filter(order => (tableFilter === 'all' ? true : order.tableId === tableFilter))
    .sort((a, b) => b.createdAt - a.createdAt);

  // Log thao tác vào order.history
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

  // Thay đổi trạng thái món, huỷ món, phục hồi, thay đổi số lượng/note
  const updateOrderItems = async (order, items, logEntry) => {
    await updateDoc(doc(db, 'orders', order.id), { items });
    if (logEntry) await logHistory(order.id, logEntry);
  };

  // Khi thanh toán, cập nhật trạng thái bàn
  const updateOrderStatus = async (order) => {
    const username = getUsername();
    await updateDoc(doc(db, 'orders', order.id), {
      status: 'complete',
      paidAt: Date.now()
    });
    try {
      await updateDoc(doc(db, 'tables', order.tableId), {
        status: 'available',
        currentOrderId: ''
      });
    } catch {}
    await logHistory(order.id, { action: 'complete', note: 'Đã thanh toán', user: username });
    setSnack({ open: true, msg: 'Đã thanh toán và cập nhật trạng thái bàn!', severity: 'success' });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 1, md: 2 } }}>
      <Typography variant="h5" fontWeight="bold" mb={2}>🍽️ Quản lý đơn hàng</Typography>

      <Button
        variant="contained"
        color="primary"
        sx={{ mb: 2 }}
        onClick={() => navigate('/tables')}
      >
        ➕ Tạo đơn hàng mới
      </Button>

      {/* Filter - responsive */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        mb={2}
      >
        <Box flex={1}>
          <Typography>Bàn:</Typography>
          <Select
            value={tableFilter}
            onChange={e => setTableFilter(e.target.value)}
            size="small"
            fullWidth={isMobile}
            sx={{ minWidth: 100 }}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            {tableIds.map(tid => <MenuItem key={tid} value={tid}>{tid}</MenuItem>)}
          </Select>
        </Box>
        <Box flex={1}>
          <Typography>Trạng thái:</Typography>
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            size="small"
            fullWidth={isMobile}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="pending">Đang xử lý</MenuItem>
            <MenuItem value="complete">Đã thanh toán</MenuItem>
            <MenuItem value="cancel">Đã huỷ</MenuItem>
          </Select>
        </Box>
        <Box flex={2}>
          <Typography>Lọc ngày:</Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={vi}>
            <DatePicker
              
              value={dateFilter}
              onChange={setDateFilter}
              slotProps={{
                textField: { size: "small", fullWidth: isMobile, sx: { minWidth: 140 } }
              }}
              format="dd/MM/yyyy"
              clearable
            />
          </LocalizationProvider>
          {dateFilter && (
            <Button
              variant="text"
              color="error"
              size="small"
              fullWidth={isMobile}
              onClick={() => setDateFilter(null)}
              sx={{ mt: isMobile ? 1 : 0 }}
            >
              Xoá ngày
            </Button>
          )}
        </Box>
      </Stack>

      {filteredOrders.length === 0 && <Typography color="text.secondary">Không có đơn nào.</Typography>}
      {filteredOrders.map(order => (
        <Accordion key={order.id} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>
              🧾 {order.orderCode || order.id} | Bàn {order.tableId} | 
              <Chip label={order.status} color={statusColor[order.status] || 'default'} size="small" sx={{ mx: 1 }} />
              {order.items?.length || 0} món | <b>{getOrderTotal(order, menuMap).toLocaleString('vi-VN')}₫</b>
              <Button variant="text" size="small" sx={{ ml: 2 }} onClick={e => { e.stopPropagation(); setHistoryDialog({ open: true, order }); }}>Lịch sử</Button>
              <Typography variant="caption" sx={{ ml: 2 }}>
                {order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN', {
                  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                }) : ''}
              </Typography>
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tên món</TableCell>
                    <TableCell>SL</TableCell>
                    <TableCell>Ghi chú</TableCell>
                    <TableCell>Đơn giá</TableCell>
                    <TableCell>Thành tiền</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell>Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.items?.map((item, idx) => {
                    const price = menuMap[item.name]?.price ?? item.price ?? 0;
                    const total = price * item.quantity;
                    const username = getUsername();
                    return (
                      <TableRow key={idx}
                        sx={item.status === 'cancel' ? { color: "#bbb", fontStyle: "italic", background: "#f7f7f7" } : {}}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          {item.status === 'pending' ? (
                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              sx={{ width: 60 }}
                              onChange={async e => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                const updatedItems = [...order.items];
                                updatedItems[idx].quantity = val;
                                await updateOrderItems(order, updatedItems, {
                                  action: 'edit_quantity',
                                  note: `Sửa số lượng ${item.name} thành ${val}`,
                                  user: username
                                });
                              }}
                            />
                          ) : item.quantity}
                        </TableCell>
                        <TableCell>
                          {item.status === 'pending' ? (
                            <>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <span>{item.note || ''}</span>
                                <Button
                                  variant="text"
                                  size="small"
                                  onClick={() => setNoteDialog({ open: true, value: item.note || '', orderId: order.id, itemIdx: idx })}
                                  title="Sửa ghi chú"
                                ><EditNoteIcon fontSize="small" /></Button>
                              </Stack>
                            </>
                          ) : item.note}
                        </TableCell>
                        <TableCell>
                          {price.toLocaleString('vi-VN')}₫
                        </TableCell>
                        <TableCell>
                          {total.toLocaleString('vi-VN')}₫
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={{
                              pending: 'Chờ bếp',
                              served: 'Đã phục vụ',
                              cancel: 'Đã huỷ',
                              complete: 'Đã thanh toán'
                            }[item.status] || item.status}
                            size="small"
                            color={item.status === 'pending'
                              ? 'warning'
                              : item.status === 'served'
                              ? 'success'
                              : item.status === 'cancel'
                              ? 'default'
                              : 'info'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            {item.status === 'pending' && (
                              <>
                                <Button
                                  size="small"
                                  color="success"
                                  onClick={async () => {
                                    const updatedItems = [...order.items];
                                    updatedItems[idx].status = 'served';
                                    await updateOrderItems(order, updatedItems, {
                                      action: 'served',
                                      note: `Phục vụ món ${item.name}`,
                                      user: username
                                    });
                                  }}
                                >Đã phục vụ</Button>
                                <Button
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  startIcon={<DeleteOutlineIcon fontSize="small" />}
                                  onClick={async () => {
                                    const updatedItems = [...order.items];
                                    updatedItems[idx].status = 'cancel';
                                    await updateOrderItems(order, updatedItems, {
                                      action: 'cancel',
                                      note: `Huỷ món ${item.name}`,
                                      user: username
                                    });
                                    setSnack({ open: true, msg: `Đã huỷ món ${item.name}`, severity: 'info' });
                                  }}
                                >Huỷ món</Button>
                              </>
                            )}
                            {item.status === 'cancel' && (
                              <Button
                                size="small"
                                startIcon={<RestoreIcon fontSize="small" />}
                                onClick={async () => {
                                  const updatedItems = [...order.items];
                                  updatedItems[idx].status = 'pending';
                                  await updateOrderItems(order, updatedItems, {
                                    action: 'restore',
                                    note: `Phục hồi món ${item.name}`,
                                    user: username
                                  });
                                  setSnack({ open: true, msg: `Đã phục hồi món ${item.name}`, severity: 'success' });
                                }}
                              >Phục hồi</Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 1 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() =>
                  setBillDialog({
                    open: true,
                    order,
                    customerName: order.customerName || '',
                    discount: order.discount || 0,
                    note: order.billNote || '',
                    extraFee: order.extraFee || 0,
                    itemsBill: Array.isArray(order.items)
                      ? order.items.filter(i => i.status !== 'cancel').map(i => ({
                          ...i,
                          price: menuMap[i.name]?.price ?? i.price ?? 0
                        }))
                      : []
                  })
                }
              >
                In hóa đơn
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={() => updateOrderStatus(order)}
                disabled={order.items.some(item => item.status === 'pending') || order.status === 'complete'}
              >
                {order.status === 'complete' ? 'Đã thanh toán' : '✅ Thanh toán'}
              </Button>
              <Box flex={1}></Box>
              <Typography pt={1}><b>Tổng: {getOrderTotal(order, menuMap).toLocaleString('vi-VN')}₫</b></Typography>
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Dialog sửa ghi chú */}
      <Dialog
        open={noteDialog.open}
        onClose={() => setNoteDialog({ open: false, value: '', orderId: '', itemIdx: -1 })}
        fullScreen={isMobile}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Sửa ghi chú món</DialogTitle>
        <DialogContent sx={{ p: isMobile ? 1 : 3 }}>
          <TextField
            fullWidth
            label="Ghi chú"
            value={noteDialog.value}
            onChange={e => setNoteDialog({ ...noteDialog, value: e.target.value })}
            multiline minRows={2}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 1 : 3, pb: isMobile ? 1 : 2 }}>
          <Button onClick={() => setNoteDialog({ open: false, value: '', orderId: '', itemIdx: -1 })}>Huỷ</Button>
          <Button variant="contained" onClick={async () => {
            const order = orders.find(o => o.id === noteDialog.orderId);
            if (!order) return;
            const updatedItems = [...order.items];
            const username = getUsername();
            updatedItems[noteDialog.itemIdx].note = noteDialog.value;
            await updateOrderItems(order, updatedItems, {
              action: 'edit_note',
              note: `Sửa ghi chú món ${updatedItems[noteDialog.itemIdx].name}`,
              user: username
            });
            setNoteDialog({ open: false, value: '', orderId: '', itemIdx: -1 });
          }}>Lưu</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog lịch sử */}
      <Dialog
        open={historyDialog.open}
        onClose={() => setHistoryDialog({ open: false, order: null })}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Lịch sử đơn hàng</DialogTitle>
        <DialogContent sx={{ p: isMobile ? 1 : 3 }}>
          <Box sx={{ maxHeight: 350, overflow: "auto" }}>
            {historyDialog.order?.history?.length ? (
              historyDialog.order.history
                .slice()
                .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                .map((h, idx) => (
                  <Box key={idx} sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      [{h.timestamp ? new Date(h.timestamp).toLocaleString('vi-VN') : '---'}]{' '}
                      {h.user ? <b>{h.user}:</b> : null}
                    </Typography>
                    <Typography variant="body2">
                      {h.action ? <b>{h.action}:</b> : null} {h.note}
                    </Typography>
                  </Box>
                ))
            ) : (
              <Typography color="text.secondary">Chưa có lịch sử nào.</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 1 : 3, pb: isMobile ? 1 : 2 }}>
          <Button onClick={() => setHistoryDialog({ open: false, order: null })}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog chỉnh bill trước khi in */}
      <Dialog
        open={billDialog.open}
        onClose={() => setBillDialog({ open: false, order: null })}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Chỉnh sửa hóa đơn trước khi in</DialogTitle>
        <DialogContent sx={{ p: isMobile ? 1 : 3 }}>
          <Stack spacing={2}>
            <TextField
              label="Tên khách hàng"
              value={billDialog.customerName}
              onChange={e => setBillDialog(d => ({ ...d, customerName: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Ghi chú hóa đơn"
              value={billDialog.note}
              onChange={e => setBillDialog(d => ({ ...d, note: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Giảm giá (₫)"
              type="number"
              value={billDialog.discount}
              onChange={e => setBillDialog(d => ({ ...d, discount: parseInt(e.target.value) || 0 }))}
              fullWidth
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Phụ thu (₫)"
              type="number"
              value={billDialog.extraFee}
              onChange={e => setBillDialog(d => ({ ...d, extraFee: parseInt(e.target.value) || 0 }))}
              fullWidth
              inputProps={{ min: 0 }}
            />
            <TableContainer sx={{ maxHeight: 280, overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: isMobile ? 600 : 400 }}>
                <TableHead>
                  <TableRow>
                    <TableCell width={1000} >Tên món</TableCell>
                    <TableCell width={300}>SL</TableCell>
                    <TableCell width={600}>Đơn giá</TableCell>
                    <TableCell>Thành tiền</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(billDialog.itemsBill || []).map((item, idx)  => (
                    <TableRow key={idx}>
                      <TableCell>
                        <TextField
                          value={item.name}
                          onChange={e => setBillDialog(b => ({
                            ...b,
                            itemsBill: b.itemsBill.map((it, i) =>
                              i === idx ? { ...it, name: e.target.value } : it
                            )
                          }))}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.quantity}
                          inputProps={{ min: 1 }}
                          onChange={e => setBillDialog(b => ({
                            ...b,
                            itemsBill: b.itemsBill.map((it, i) =>
                              i === idx ? { ...it, quantity: Math.max(1, parseInt(e.target.value) || 1) } : it
                            )
                          }))}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.price}
                          inputProps={{ min: 0 }}
                          onChange={e => setBillDialog(b => ({
                            ...b,
                            itemsBill: b.itemsBill.map((it, i) =>
                              i === idx ? { ...it, price: Math.max(0, parseInt(e.target.value) || 0) } : it
                            )
                          }))}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {(item.price * item.quantity).toLocaleString('vi-VN')}₫
                      </TableCell>
                      <TableCell>
                        <Button
                          color="error"
                          size="small"
                          onClick={() => setBillDialog(b => ({
                            ...b,
                            itemsBill: b.itemsBill.filter((_, i) => i !== idx)
                          }))}
                        >Xóa</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 1 : 3, pb: isMobile ? 1 : 2 }}>
          <Button onClick={() => setBillDialog({ open: false, order: null })}>Hủy</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() =>
              printToLAN(
                {
                  order: billDialog.order,
                  menuMap: menuMap,
                  itemsBill: billDialog.itemsBill,
                  discount: billDialog.discount,
                  extraFee: billDialog.extraFee,
                  customerName: billDialog.customerName,
                  note: billDialog.note,
                  showVietQR: true
                },
                'bar'
              )
            }
          >
            In máy in BAR
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
