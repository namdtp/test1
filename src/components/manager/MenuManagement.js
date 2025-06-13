import React, { useState, useMemo } from 'react';
import { collection, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import * as XLSX from 'xlsx';
import {
  Box, Typography, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Stack, Button, Divider, TextField,
  Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Chip
} from '@mui/material';
import { useMenu } from '../../contexts/MenuContext';

function capitalize(str) {
  return str && str[0]?.toUpperCase() + str.slice(1);
}

const normalize = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const MenuManagement = () => {
  const menuItems = useMenu();

  // State filter, dialog và dữ liệu nhập
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterName, setFilterName] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [newItem, setNewItem] = useState({
    name: '', price: '', category: '', available: true,
    groupCode: '', groupName: '', typeCode: ''
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const [editItem, setEditItem] = useState({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [snack, setSnack] = useState({open: false, msg: '', severity: 'success'});
  const [highlightId, setHighlightId] = useState('');

  // Danh mục hiện có (không lặp)
  const allCategories = useMemo(
    () => [...new Set(menuItems.map(item => item.category).filter(Boolean))],
    [menuItems]
  );

  // Filter nâng cao (bỏ dấu tên)
  const filteredItems = useMemo(() => {
    let result = menuItems;
    if (filterCategory !== 'all') {
      result = result.filter(item => item.category === filterCategory);
    }
    if (filterStatus !== 'all') {
      result = result.filter(item => filterStatus === 'available' ? item.available : !item.available);
    }
    if (filterName.trim()) {
      const terms = filterName.trim().split(/\s+/).map(normalize);
      result = result.filter(item =>
        terms.every(term => normalize(item.name).includes(term))
      );
    }
    return result;
  }, [menuItems, filterCategory, filterStatus, filterName]);

  // Handler thay đổi field nhập (cả Dialog thêm và sửa)
  const handleChange = (setter) => (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'category' && value) {
      setter((prev) => ({ ...prev, [name]: capitalize(value) }));
    } else if (name === 'name' && value) {
      setter((prev) => ({ ...prev, [name]: capitalize(value) }));
    } else {
      setter((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
    setError('');
  };

  // Mở Dialog thêm món và reset form
  const handleOpenAddDialog = () => {
    setNewItem({
      name: '', price: '', category: '', available: true,
      groupCode: '', groupName: '', typeCode: ''
    });
    setError('');
    setAddDialogOpen(true);
  };

  // Validate tên đã tồn tại
  const nameExists = (name) => {
    if (!name) return false;
    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[\/\\.#$\[\]]/g, '_');
    return menuItems.some(item => item.id === id);
  };

  // Thêm món mới
  const addMenuItem = async () => {
    const { name, price, category } = newItem;
    if (!name || !price || !category) return setError('Vui lòng nhập đầy đủ tên món, giá và danh mục!');
    if (nameExists(name)) return setError('Món ăn đã tồn tại! Vui lòng chọn tên khác.');
    const parsedPrice = parseInt(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) return setError('Giá phải là một số lớn hơn 0!');

    try {
      const docId = name.toLowerCase().replace(/\s+/g, '_').replace(/[\/\\.#$\[\]]/g, '_');
      await setDoc(doc(db, 'menu', docId), { ...newItem, price: parsedPrice });
      setHighlightId(docId);
      setAddDialogOpen(false);
      setNewItem({ name: '', price: '', category: '', available: true, groupCode: '', groupName: '', typeCode: '' });
      setError('');
      setSnack({open: true, msg: 'Đã thêm món thành công!', severity: 'success'});
      setTimeout(() => setHighlightId(''), 2000);
    } catch (err) { setError('Lỗi khi thêm món: ' + err.message); }
  };

  // Sửa món
  const startEdit = (item) => {
    setEditItemId(item.id);
    setEditItem({ ...item, price: item.price.toString() });
    setEditDialogOpen(true);
    setError('');
  };

  const saveEdit = async () => {
    const { name, price, category } = editItem;
    if (!name || !price || !category) return setError('Vui lòng nhập đầy đủ tên món, giá và danh mục!');
    const newDocId = name.toLowerCase().replace(/\s+/g, '_').replace(/[\/\\.#$\[\]]/g, '_');
    if (newDocId !== editItemId && menuItems.some(item => item.id === newDocId)) {
      return setError('Tên món đã tồn tại! Vui lòng chọn tên khác.');
    }
    const parsedPrice = parseInt(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) return setError('Giá phải là một số lớn hơn 0!');
    try {
      await setDoc(doc(db, 'menu', newDocId), { ...editItem, price: parsedPrice });
      if (newDocId !== editItemId) await deleteDoc(doc(db, 'menu', editItemId));
      setHighlightId(newDocId);
      setEditItemId(null);
      setEditItem({});
      setEditDialogOpen(false);
      setError('');
      setSnack({open: true, msg: 'Cập nhật món thành công!', severity: 'success'});
      setTimeout(() => setHighlightId(''), 2000);
    } catch (err) { setError('Lỗi khi sửa món: ' + err.message); }
  };

  // Xoá món
  const deleteMenuItem = async (id) => {
    try {
      await deleteDoc(doc(db, 'menu', id));
      setSnack({open: true, msg: 'Đã xoá món!', severity: 'info'});
    }
    catch (err) { setError('Lỗi khi xóa món: ' + err.message); }
  };

  // Import Excel: báo số món bỏ qua vì trùng
  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    let skipped = 0, added = 0;
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        const existingDocIds = new Set(menuItems.map(item => item.id));

        for (const row of data) {
          const name = row['Tên']?.toString().trim();
          const price = parseInt(row['Giá']);
          const available = true;
          const groupCode = row['Nhóm']?.toString().trim() || '';
          const groupName = row['Tên nhóm']?.toString().trim() || '';
          const typeCode = row['Loại món']?.toString().trim() || '';
          const category = row['Tên loại']?.toString().trim() || '';
          if (!name || isNaN(price)) continue;
          const docId = name.toLowerCase().replace(/\s+/g, '_').replace(/[\/\\.#$\[\]]/g, '_');
          if (existingDocIds.has(docId)) { skipped++; continue; }
          await setDoc(doc(db, 'menu', docId), { name: capitalize(name), price, available, groupCode, groupName, typeCode, category: capitalize(category) });
          added++;
        }
        setSnack({open: true, msg: `Đã import: ${added} món mới${skipped ? `, bỏ qua ${skipped} món đã có` : ''}`, severity: 'success'});
        setError('');
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setError('Lỗi khi import: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCloseSnack = () => setSnack(s => ({...s, open: false}));

  return (
    <Box sx={{ p: { xs: 1, md: 4 }, maxWidth: '1200px', mx: 'auto' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>📋 Quản lý Menu</Typography>
      <Divider sx={{ mb: 2 }} />

      {/* Filter + Thao tác */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        mb={2}
        flexWrap="wrap"
      >
        {/* Bộ lọc */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          flex={1}
          minWidth={200}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <FormControl sx={{ minWidth: { xs: 0, sm: 160 }, flex: 1 }}>
            <InputLabel>Danh mục</InputLabel>
            <Select value={filterCategory} label="Danh mục" onChange={(e) => setFilterCategory(e.target.value)}>
              <MenuItem value="all">Tất cả</MenuItem>
              {allCategories.map((cat, idx) => (
                <MenuItem key={idx} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: { xs: 0, sm: 140 }, flex: 1 }}>
            <InputLabel>Trạng thái</InputLabel>
            <Select value={filterStatus} label="Trạng thái" onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="all">Tất cả</MenuItem>
              <MenuItem value="available">Có sẵn</MenuItem>
              <MenuItem value="unavailable">Hết hàng</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Tìm kiếm món"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            variant="outlined"
            size="small"
            sx={{
              minWidth: { xs: 0, sm: 160 },
              flex: 2
            }}
            fullWidth
          />
        </Stack>
        {/* Actions */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          ml={{ xs: 0, sm: 2 }}
          mt={{ xs: 2, sm: 0 }}
          sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: "flex-end", sm: "unset" } }}
        >
          <Button variant="contained" fullWidth={true} onClick={handleOpenAddDialog}>
            + Thêm món
          </Button>
          <Button
            component="label"
            variant="outlined"
            startIcon={<span role="img" aria-label="import">📥</span>}
            sx={{ minWidth: 120, textTransform: "none" }}
            fullWidth={true}
          >
            Import Excel
            <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={importing} hidden />
          </Button>
          <Button
            variant="text"
            color="secondary"
            sx={{ fontSize: 13, fontWeight: 500 }}
            onClick={() => { setFilterCategory('all'); setFilterStatus('all'); setFilterName(''); }}
            fullWidth={true}
          >
            Đặt lại filter
          </Button>
        </Stack>
      </Stack>

      {error && <Typography color="error" mb={2}>{error}</Typography>}

      {/* Table */}
      <Paper elevation={3} sx={{ borderRadius: 2, overflowX: "auto" }}>
        <Typography sx={{ px: 2, pt: 2 }}>Tổng số: <b>{filteredItems.length}</b> món</Typography>
        <Box sx={{ minWidth: 700, width: "100%" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Tên</strong></TableCell>
                <TableCell><strong>Giá</strong></TableCell>
                <TableCell><strong>Danh mục</strong></TableCell>
                <TableCell><strong>Nhóm</strong></TableCell>
                <TableCell><strong>Loại</strong></TableCell>
                <TableCell><strong>Trạng thái</strong></TableCell>
                <TableCell><strong>Hành động</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow
                  key={item.id}
                  sx={{
                    background: item.id === highlightId ? '#ffe9bb' : 'inherit',
                    transition: 'background 0.4s'
                  }}
                >
                  <TableCell>
                    {item.name}
                    {!item.available && <Chip label="Hết hàng" size="small" color="warning" sx={{ml:1}} />}
                  </TableCell>
                  <TableCell>{item.price}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.groupName}</TableCell>
                  <TableCell>{item.typeCode}</TableCell>
                  <TableCell>{item.available ? 'Có sẵn' : 'Hết hàng'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => startEdit(item)}>Sửa</Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => deleteMenuItem(item.id)}>Xoá</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Dialog Thêm món */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
        <DialogTitle>Thêm món mới</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              name="name" label="Tên món" variant="outlined" size="small"
              value={newItem.name} onChange={handleChange(setNewItem)} fullWidth
              error={!!newItem.name && nameExists(newItem.name)}
              helperText={!!newItem.name && nameExists(newItem.name) ? 'Tên món đã tồn tại!' : ''}
            />
            <TextField
              name="price" label="Giá" variant="outlined" size="small"
              value={newItem.price} onChange={handleChange(setNewItem)} fullWidth
              type="number"
            />
            <FormControl fullWidth>
              <InputLabel>Danh mục</InputLabel>
              <Select
                name="category"
                value={newItem.category}
                label="Danh mục"
                onChange={handleChange(setNewItem)}
              >
                <MenuItem value="">-- Chọn --</MenuItem>
                {allCategories.map((cat, idx) => (
                  <MenuItem key={idx} value={cat}>{cat}</MenuItem>
                ))}
                <MenuItem value={newItem.category}>{newItem.category}</MenuItem>
              </Select>
            </FormControl>
            <TextField name="groupCode" label="Mã nhóm" size="small" value={newItem.groupCode} onChange={handleChange(setNewItem)} fullWidth />
            <TextField name="groupName" label="Tên nhóm" size="small" value={newItem.groupName} onChange={handleChange(setNewItem)} fullWidth />
            <TextField name="typeCode" label="Loại món" size="small" value={newItem.typeCode} onChange={handleChange(setNewItem)} fullWidth />
            <FormControlLabel
              control={<Checkbox checked={newItem.available} name="available" onChange={handleChange(setNewItem)} />}
              label="Có sẵn"
            />
            {error && <Typography color="error">{error}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={addMenuItem} disabled={!!newItem.name && nameExists(newItem.name)}>Thêm</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Sửa món */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Chỉnh sửa món</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              name="name" label="Tên món" variant="outlined" size="small"
              value={editItem.name || ''} onChange={handleChange(setEditItem)} fullWidth
              error={!!editItem.name && editItem.name !== menuItems.find(i => i.id === editItemId)?.name && nameExists(editItem.name)}
              helperText={
                !!editItem.name && editItem.name !== menuItems.find(i => i.id === editItemId)?.name && nameExists(editItem.name)
                  ? 'Tên món đã tồn tại!' : ''
              }
            />
            <TextField
              name="price" label="Giá" variant="outlined" size="small"
              value={editItem.price || ''} onChange={handleChange(setEditItem)} fullWidth
              type="number"
            />
            <FormControl fullWidth>
              <InputLabel>Danh mục</InputLabel>
              <Select
                name="category"
                value={editItem.category || ''}
                label="Danh mục"
                onChange={handleChange(setEditItem)}
              >
                <MenuItem value="">-- Chọn --</MenuItem>
                {allCategories.map((cat, idx) => (
                  <MenuItem key={idx} value={cat}>{cat}</MenuItem>
                ))}
                <MenuItem value={editItem.category || ''}>{editItem.category || ''}</MenuItem>
              </Select>
            </FormControl>
            <TextField name="groupCode" label="Mã nhóm" size="small" value={editItem.groupCode || ''} onChange={handleChange(setEditItem)} fullWidth />
            <TextField name="groupName" label="Tên nhóm" size="small" value={editItem.groupName || ''} onChange={handleChange(setEditItem)} fullWidth />
            <TextField name="typeCode" label="Loại món" size="small" value={editItem.typeCode || ''} onChange={handleChange(setEditItem)} fullWidth />
            <FormControlLabel
              control={<Checkbox checked={editItem.available || false} name="available" onChange={handleChange(setEditItem)} />}
              label="Có sẵn"
            />
            {error && <Typography color="error">{error}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={saveEdit}
            disabled={!!editItem.name && editItem.name !== menuItems.find(i => i.id === editItemId)?.name && nameExists(editItem.name)}
          >Lưu</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={handleCloseSnack}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default MenuManagement;
