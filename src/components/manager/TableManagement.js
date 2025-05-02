import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
  Typography, TextField, Button, Paper, Stack, Table, TableHead, TableRow, TableCell, TableBody, Chip
} from '@mui/material';

const TableManagement = () => {
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [newTableName, setNewTableName] = useState('');
  const [newTableRow, setNewTableRow] = useState('');
  const [error, setError] = useState('');
  const [editTableId, setEditTableId] = useState(null);
  const [editTableStatus, setEditTableStatus] = useState('available');

  useEffect(() => {
    const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTables(data);
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });

    return () => {
      unsubTables();
      unsubOrders();
    };
  }, []);

  const addTable = async () => {
    if (!newTableName || !newTableRow) {
      return setError('Vui lòng nhập tên bàn và hàng!');
    }

    const tableId = `${newTableName}_${newTableRow}`.toLowerCase().replace(/\s+/g, '');

    const isDuplicate = tables.some(t => t.id === tableId);
    if (isDuplicate) return setError('Bàn này đã tồn tại!');

    try {
      await setDoc(doc(db, 'tables', tableId), {
        name: newTableName.trim(),
        row: newTableRow.trim(),
        status: 'available',
        currentOrderId: null
      });

      setNewTableName('');
      setNewTableRow('');
      setError('');
    } catch (err) {
      setError('Lỗi khi thêm bàn: ' + err.message);
    }
  };

  const saveEdit = async (tableId) => {
    try {
      await updateDoc(doc(db, 'tables', tableId), { status: editTableStatus });
      if (editTableStatus === 'available') {
        await updateDoc(doc(db, 'tables', tableId), { currentOrderId: null });
      }
      setEditTableId(null);
      setEditTableStatus('available');
    } catch (err) {
      setError('Lỗi khi sửa bàn: ' + err.message);
    }
  };

  const deleteTable = async (tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (table.status === 'occupied') return setError('Không thể xóa bàn đang có khách!');
    try {
      await deleteDoc(doc(db, 'tables', tableId));
      setError('');
    } catch (err) {
      setError('Lỗi khi xóa bàn: ' + err.message);
    }
  };

  const getTotalForTable = (tableId) => {
    const pendingOrders = orders.filter(
      (order) => order.tableId === tableId && order.status === 'pending'
    );
    return pendingOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  };

  return (
    <div>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Quản lý Bàn
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2}>
          <TextField
            label="Tên bàn (ví dụ: VIP 1)"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            fullWidth
          />
          <TextField
            label="Hàng (ví dụ: A, B)"
            value={newTableRow}
            onChange={(e) => setNewTableRow(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={addTable}>Thêm bàn</Button>
        </Stack>
        {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
      </Paper>

      <Typography variant="h6" gutterBottom>Danh sách Bàn</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><strong>Tên bàn</strong></TableCell>
            <TableCell><strong>Hàng</strong></TableCell>
            <TableCell><strong>Trạng thái</strong></TableCell>
            <TableCell><strong>Tổng tiền</strong></TableCell>
            <TableCell><strong>Đơn hàng</strong></TableCell>
            <TableCell><strong>Hành động</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tables.map((table) => (
            <TableRow key={table.id}>
              <TableCell>{table.name || table.id}</TableCell>
              <TableCell>{table.row || '---'}</TableCell>
              <TableCell>
                {editTableId === table.id ? (
                  <TextField
                    select
                    SelectProps={{ native: true }}
                    value={editTableStatus}
                    onChange={(e) => setEditTableStatus(e.target.value)}
                    size="small"
                  >
                    <option value="available">Trống</option>
                    <option value="occupied">Đã chiếm</option>
                  </TextField>
                ) : (
                  <Chip
                    label={table.status === 'available' ? 'Trống' : 'Đã chiếm'}
                    color={table.status === 'available' ? 'success' : 'error'}
                    size="small"
                  />
                )}
              </TableCell>
              <TableCell>{getTotalForTable(table.id).toLocaleString('vi-VN')}₫</TableCell>
              <TableCell>{table.currentOrderId || '---'}</TableCell>
              <TableCell>
                {editTableId === table.id ? (
                  <>
                    <Button size="small" onClick={() => saveEdit(table.id)}>Lưu</Button>
                    <Button size="small" color="inherit" onClick={() => setEditTableId(null)}>Hủy</Button>
                  </>
                ) : (
                  <>
                    <Button size="small" onClick={() => {
                      setEditTableId(table.id);
                      setEditTableStatus(table.status);
                    }}>Sửa</Button>
                    <Button size="small" color="error" onClick={() => deleteTable(table.id)}>Xóa</Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TableManagement;
