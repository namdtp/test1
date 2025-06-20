import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
  Box, Tooltip, Typography, Button, TextField, Stack, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl, Paper, Divider
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import './Staff.css';
// import KitchenAutoPrinter from './KitchenAutoPrinter';



const Staff = () => {

  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeTableId, setMergeTableId] = useState('');
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuMap, setMenuMap] = useState({});
  const [userEmail, setUserEmail] = useState('');
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState('');
  const [customItemDialogOpen, setCustomItemDialogOpen] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', price: '', quantity: 1, note: '' });

  const [editOrderNoteDialog, setEditOrderNoteDialog] = useState(false);
  const [editOrderNote, setEditOrderNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const tableId = new URLSearchParams(location.search).get('tableId');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Fetch pending order for this table
  useEffect(() => {
    if (!tableId) return;
    const q = query(
      collection(db, 'orders'),
      where('tableId', '==', tableId),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });
    return () => unsub();
  }, [tableId]);

  // Khi chọn chỉnh sửa, tự fill note hiện tại
  useEffect(() => {
    if (orders.length > 0) {
      setEditOrderNote(orders[0].billNote || '');
    }
  }, [orders, editOrderNoteDialog]);

  // Fetch all tables
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTables(data);
    });
    return () => unsub();
  }, []);

  // Fetch menu
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'menu'), (snapshot) => {
      const map = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.name) map[data.name] = data;
      });
      setMenuMap(map);
    });
    return () => unsub();
  }, []);

  // Fetch user email for log
  useEffect(() => {
    const fetchUserEmail = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) setUserEmail(userDoc.data().email);
      }
    };
    fetchUserEmail();
  }, []);

  // ===== LOG ACTION =====
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

  // Hàm lưu lại log vào history của order khi đổi ghi chú
async function addOrderLog(orderId, user, newNote) {
  const orderRef = doc(db, "orders", orderId);
  const snap = await getDoc(orderRef);
  if (!snap.exists()) return;
  const oldOrder = snap.data();
  const oldNote = oldOrder.billNote || "";

  // Thêm log vào history
  const now = Date.now();
  const newHistory = [
    ...(oldOrder.history || []),
    {
      action: "update_bill_note",
      user: user || "staff",
      timestamp: now,
      from: oldNote,
      to: newNote,
      note: "Cập nhật chú thích đơn hàng",
    },
  ];
  await updateDoc(orderRef, {
    billNote: newNote,
    history: newHistory,
  });
}


const handleSaveOrderNote = async () => {
  if (!orders[0]) return;
  setSavingNote(true);
  try {
    await addOrderLog(
      orders[0].id,
      userEmail || "staff",
      editOrderNote
    );
    setEditOrderNoteDialog(false);
  } catch (e) {
    alert("Có lỗi khi lưu ghi chú đơn: " + e.message);
  } finally {
    setSavingNote(false);
  }
};

  // ---- Chuyển bàn ----
  const handleMoveTable = async () => {
    const order = orders[0];
    if (!order || !selectedTable) return;

    await updateDoc(doc(db, 'orders', order.id), { tableId: selectedTable });
    await updateDoc(doc(db, 'tables', tableId), { status: 'available', currentOrderId: null });
    await updateDoc(doc(db, 'tables', selectedTable), { status: 'occupied', currentOrderId: order.id });

    await logHistory(order.id, {
      action: 'move',
      note: `Chuyển đơn từ bàn ${tableId} sang bàn ${selectedTable}`,
      user: userEmail
    });

    setMoveDialogOpen(false);
    navigate(`/staff?tableId=${selectedTable}`);
  };

  // ---- Ghép bàn ----
  const handleMergeTables = async () => {
    const targetOrder = orders[0];
    const mergeOrderSnap = await getDoc(doc(db, 'orders', mergeTableId));
    if (!targetOrder || !mergeTableId || !mergeOrderSnap.exists()) return;

    const mergeOrder = mergeOrderSnap.data();
    const mergedItems = [...targetOrder.items];
    for (const item of mergeOrder.items || []) {
      const idx = mergedItems.findIndex(i => i.name === item.name && i.status === item.status);
      if (idx !== -1) {
        mergedItems[idx].quantity += item.quantity;
      } else {
        mergedItems.push(item);
      }
    }

    await updateDoc(doc(db, 'orders', targetOrder.id), { items: mergedItems });
    await updateDoc(doc(db, 'orders', mergeTableId), { status: 'cancel' });
    await updateDoc(doc(db, 'tables', mergeOrder.tableId), { status: 'available', currentOrderId: null });

    await logHistory(targetOrder.id, {
      action: 'merge',
      note: `Ghép đơn từ bàn ${mergeOrder.tableId}`,
      user: userEmail
    });

    await logHistory(mergeTableId, {
      action: 'cancel-after-merge',
      note: `Đơn bị ghép vào bàn ${targetOrder.tableId}`,
      user: userEmail
    });

    setMergeDialogOpen(false);
    setMergeTableId('');
  };

  // ---- Phục vụ món ----
  const getDynamicStatus = (item) => {
    if (item.status === 'served') return 'served';
    if (item.status === 'cancel') return 'cancel';
    const now = Date.now();
    const createdTime = parseInt(item.timestamp);
    const elapsedMin = (now - createdTime) / 60000;
    if (elapsedMin > 20) return 'late';
    if (elapsedMin > 5) return 'pending';
    return 'new';
  };

  const handleServeItem = async (order, index) => {
    const sortedItems = order.items
      .slice()
      .sort((a, b) => {
        const sA = getDynamicStatus(a);
        const sB = getDynamicStatus(b);
        const priority = status => (status === 'pending' || status === 'new') ? 0 : (status === 'late' ? 1 : (status === 'served' ? 2 : 3));
        return priority(sA) - priority(sB);
      });

    const item = sortedItems[index]; // item trên UI
    const realIndex = order.items.findIndex(
      i => i.name === item.name && i.timestamp === item.timestamp
    );
    if (realIndex === -1) return;

    const updatedOrder = { ...order, items: [...order.items] };
    updatedOrder.items[realIndex].status = 'served';

    await updateDoc(doc(db, 'orders', order.id), {
      items: updatedOrder.items
    });
    await logHistory(order.id, {
      action: 'serve',
      item: updatedOrder.items[realIndex].name,
      user: userEmail
    });
  };

  // ---- Thêm món ngoài menu ----
  const handleAddCustomItem = async () => {
    const order = orders[0];
    if (!order) return;

    if (!customItem.name.trim() || !customItem.price || !customItem.quantity) {
      alert('Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    const updatedItems = [...order.items, {
      name: customItem.name.trim(),
      price: Number(customItem.price),
      quantity: Number(customItem.quantity),
      note: customItem.note,
      status: 'pending',
      timestamp: Date.now(),
      isCustom: true
    }];

    await updateDoc(doc(db, 'orders', order.id), { items: updatedItems });

    await logHistory(order.id, {
      action: 'add-custom-item',
      item: customItem.name.trim(),
      user: userEmail,
      note: 'Thêm món ngoài menu'
    });

    setCustomItemDialogOpen(false);
    setCustomItem({ name: '', price: '', quantity: 1, note: '' });
  };

  // Helper render row cho table desktop với sắp xếp món pending lên trên
  function renderRowSorted(order) {
    return order.items
      .slice().sort((a, b) => {
        const sA = getDynamicStatus(a);
        const sB = getDynamicStatus(b);
        const priority = status => (status === 'pending' || status === 'new') ? 0 : (status === 'late' ? 1 : (status === 'served' ? 2 : 3));
        return priority(sA) - priority(sB);
      })
      .map((item, index) => (
        <tr key={order.id + '-' + index}>
          <td>
            {item.name || '---'}
            {item.isCustom && (
              <span style={{ color: '#f57c00', fontSize: 12, marginLeft: 4 }} title="Món ngoài menu">(tự nhập)</span>
            )}
          </td>
          <td>{menuMap[item.name]?.category || (item.isCustom ? 'Ngoài menu' : '---')}</td>
          <td>{renderStatus(item)}</td>
          <td>{item.quantity}</td>
          <td>
            {item.note || new Date(parseInt(item.timestamp)).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </td>
          <td>
            {order.status === 'pending' && item.status !== 'served' && item.status !== 'cancel' && (
              <Button size="small" color="success" onClick={() => handleServeItem(order, index)}>
                Đã phục vụ
              </Button>
            )}
          </td>
        </tr>
      ));
  }

  // Tương tự render card mobile với sắp xếp món pending lên trên
  function renderCardSorted(order) {
    return order.items
      .slice()
      .sort((a, b) => {
        const sA = getDynamicStatus(a);
        const sB = getDynamicStatus(b);
        const priority = status => (status === 'pending' || status === 'new') ? 0 : (status === 'late' ? 1 : (status === 'served' ? 2 : 3));
        return priority(sA) - priority(sB);
      })
      .map((item, index) => (
        <Paper key={order.id + '-' + index} elevation={3} className="order-card">
          <Box flex={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.7}>
              <Typography fontWeight={700} fontSize={18}>{item.name}</Typography>
              {item.isCustom && <Typography fontSize={12} color="#ff9800">(tự nhập)</Typography>}
              {order.status === 'pending' && item.status !== 'served' && item.status !== 'cancel' && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleServeItem(order, index)}
                >
                  Đã phục vụ
                </Button>
              )}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.7}>
              {renderStatus(item)}
              <Typography fontSize={15} color="#333" ml={1}>
                SL: <strong>{item.quantity}</strong>
              </Typography>
            </Stack>
            <Typography fontSize={13} color="#8a8a8a" mb={0.7}>
              {menuMap[item.name]?.category || (item.isCustom ? 'Ngoài menu' : '---')}
            </Typography>
            {item.note && (
              <Typography fontSize={13} color="text.secondary" mb={0.7}>
                Ghi chú: {item.note}
              </Typography>
            )}
            <Typography fontSize={12} color="#bdbdbd">
              {new Date(parseInt(item.timestamp)).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </Paper>
      ));
  }

  // Chip trạng thái
  const renderStatus = (item) => {
    const status = getDynamicStatus(item);
    const map = {
      new: 'status-new',
      pending: 'status-pending',
      late: 'status-late',
      served: 'status-done',
      cancel: 'status-cancel',
    };
    const labelMap = {
      new: 'Mới',
      pending: 'Đang chờ',
      late: 'Quá lâu',
      served: 'Đã phục vụ',
      cancel: 'Hủy',
    };
    return <span className={`status-chip ${map[status] || 'status-pending'}`}>{labelMap[status]}</span>;
  };

  const formatOrderCode = (order, index) => {
    const date = new Date(order.createdAt || order.items[0]?.timestamp || Date.now());
    const dateStr = date.toLocaleDateString('vi-VN').replaceAll('/', '');
    return `${dateStr}/table${order.tableId}/${(index + 1).toString().padStart(3, '0')}`;
  };

  // ==== UI ====
  const goToOrderPage = () => navigate(`/order?tableId=${tableId}`);
  const goBackToTables = () => navigate('/tables');

  

  return (
    <Box sx={{ p: { xs: 1, md: 4 }, maxWidth: '1000px', mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} mb={isMobile ? 1 : 2}>
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"} fontWeight="bold">Bàn {tableId || 'X'}</Typography>
          {orders.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              Mã đơn: {formatOrderCode(orders[0], 0)} - Trạng thái: <strong>{orders[0].status}</strong>
            </Typography>
          )}
          {orders.length > 0 && (
          <Stack direction="row" alignItems="center" spacing={1} mt={0.5} mb={1.5}>
            <Tooltip
              title={
                orders[0].billNote
                  ? orders[0].billNote
                  : "Chưa có chú thích đơn"
              }
              arrow
            >
              <Typography
                variant="body2"
                color ="#101010"
  
                sx={{
                  fontStyle: "italic",
                  display: "block",
                  whiteSpace: "pre-line",
                  maxWidth: 380,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                📝 Ghi chú đơn: {orders[0].billNote}
              </Typography>
            </Tooltip>
            <Button
              size="small"
              variant="text"
              fontStyle="bold"
              onClick={() => setEditOrderNoteDialog(true)}
              sx={{ minWidth: 0, px: 1.2, py: 0.3 }}
            >
              Sửa
            </Button>
          </Stack>
        )}
        </Box>
      </Stack>

      {/* Các nút thao tác */}
      <Stack spacing={1.5} sx={{ mt: 2 }}>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={goToOrderPage} fullWidth>
            Thêm món mới
          </Button>
          <Button variant="outlined" onClick={() => setCustomItemDialogOpen(true)} fullWidth>
            ngoài menu
          </Button>
        </Stack>
        <Divider flexItem sx={{ my: 0.5 }} />
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={() => setMergeDialogOpen(true)} fullWidth>
            Ghép bàn khác
          </Button>
          <Button variant="contained" onClick={() => setMoveDialogOpen(true)} fullWidth>
            Chuyển bàn
          </Button>
        </Stack>
        <Divider flexItem sx={{ my: 0.5 }} />
        <Button variant="outlined" onClick={goBackToTables} fullWidth>
          ← Quay về
        </Button>
      </Stack>

      <Divider flexItem sx={{ my: 2 }} />

      {/* Responsive list món */}
      <Box>
        {!isMobile ? (
          <Box sx={{ overflowX: 'auto' }}>
            <table className="staff-table">
              <thead>
                <tr>
                  <th>MÓN</th>
                  <th>LOẠI</th>
                  <th>TRẠNG THÁI</th>
                  <th>SỐ LƯỢNG</th>
                  <th>THỜI GIAN / GHI CHÚ</th>
                  <th>HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {orders.flatMap(order => renderRowSorted(order))}
              </tbody>
            </table>
          </Box>
        ) : (
          <Stack spacing={2}>
            {orders.flatMap(order => renderCardSorted(order))}
          </Stack>
        )}
      </Box>
      <Dialog
  open={editOrderNoteDialog}
  onClose={() => setEditOrderNoteDialog(false)}
  maxWidth="sm"
  fullWidth
>
      <DialogTitle>Sửa ghi chú đơn hàng</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          value={editOrderNote}
          onChange={(e) => setEditOrderNote(e.target.value)}
          label="Ghi chú đơn"
          multiline
          minRows={2}
          autoFocus
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setEditOrderNoteDialog(false)}>Hủy</Button>
        <Button
          variant="contained"
          onClick={handleSaveOrderNote}
          disabled={savingNote}
        >
          Lưu
        </Button>
      </DialogActions>
    </Dialog>


      {/* Dialog chuyển bàn */}
      <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)}>
        <DialogTitle>Chuyển sang bàn khác</DialogTitle>
        <DialogContent>
          <FormControl fullWidth>
            <InputLabel>Chọn bàn</InputLabel>
            <Select value={selectedTable} label="Chọn bàn" onChange={(e) => setSelectedTable(e.target.value)}>
              {tables.filter(t => t.status === 'available' && t.id !== tableId).map(table => (
                <MenuItem key={table.id} value={table.id}>{table.name || table.id}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)}>Huỷ</Button>
          <Button onClick={handleMoveTable} variant="contained" disabled={!selectedTable}>Xác nhận</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog ghép bàn */}
      <Dialog open={mergeDialogOpen} onClose={() => setMergeDialogOpen(false)}>
        <DialogTitle>Ghép với bàn khác</DialogTitle>
        <DialogContent>
          <FormControl fullWidth>
            <InputLabel>Bàn cần ghép</InputLabel>
            <Select value={mergeTableId} label="Bàn cần ghép" onChange={(e) => setMergeTableId(e.target.value)}>
              {tables.filter(t => t.id !== tableId && t.status === 'occupied').map(t => (
                <MenuItem key={t.id} value={t.currentOrderId}>{t.name || t.id}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeDialogOpen(false)}>Huỷ</Button>
          <Button onClick={handleMergeTables} variant="contained" disabled={!mergeTableId}>Xác nhận</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog thêm món ngoài menu */}
      <Dialog open={customItemDialogOpen} onClose={() => setCustomItemDialogOpen(false)}>
        <DialogTitle>Thêm món ngoài menu</DialogTitle>
        <DialogContent>
          <TextField
            label="Tên món"
            value={customItem.name}
            onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
            fullWidth
            margin="dense"
          />
          <TextField
            label="Giá (VNĐ)"
            type="number"
            value={customItem.price}
            onChange={(e) => setCustomItem({ ...customItem, price: e.target.value })}
            fullWidth
            margin="dense"
          />
          <TextField
            label="Số lượng"
            type="number"
            value={customItem.quantity}
            onChange={(e) => setCustomItem({ ...customItem, quantity: e.target.value })}
            fullWidth
            margin="dense"
          />
          <TextField
            label="Ghi chú"
            value={customItem.note}
            onChange={(e) => setCustomItem({ ...customItem, note: e.target.value })}
            fullWidth
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomItemDialogOpen(false)}>Hủy</Button>
          <Button onClick={handleAddCustomItem} variant="contained">Thêm</Button>
        </DialogActions>
      </Dialog>
    </Box>
    
    
  );

 

  
};

export default Staff;
