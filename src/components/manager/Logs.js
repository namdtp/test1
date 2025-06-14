import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TextField, Stack, Paper, Select, MenuItem, Button, Chip, InputAdornment
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import vi from 'date-fns/locale/vi';
import * as XLSX from 'xlsx';
import SearchIcon from '@mui/icons-material/Search';

const actionColors = {
  order_create: 'info',
  order_edit: 'primary',
  order_cancel: 'error',
  complete: 'success',
  add: 'primary',
  cancel: 'error',
  served: 'success',
  print_bill: 'secondary',
  login: 'success',
  // add more if needed
};

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(null);

  // Load cả logs thao tác đơn hàng (order.history) và logs đăng nhập (collection 'logs')
  useEffect(() => {
    const fetchLogs = async () => {
      let allLogs = [];
      // Lấy logs thao tác từ đơn hàng
      const snap = await getDocs(collection(db, 'orders'));
      snap.forEach(doc => {
        const order = doc.data();
        const orderId = doc.id;
        (order.history || []).forEach(h => {
          allLogs.push({
            ...h,
            action: h.action || '',
            user: h.user || '',
            note: h.note || '',
            orderId,
             orderCode: order.orderCode,
            tableId: order.tableId,
            timestamp: h.timestamp,
          });
        });
      });
      // Lấy logs đăng nhập từ collection logs
      const loginSnap = await getDocs(collection(db, 'logs'));
      loginSnap.forEach(doc => {
        const log = doc.data();
        allLogs.push({
          ...log,
          action: log.type || 'login',
          user: log.email || log.uid || '',
          note: log.note || '',
          orderId: '',
          tableId: '',
          timestamp: log.timestamp
        });
      });
      // Sắp xếp mới nhất lên đầu
      allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setLogs(allLogs);
    };
    fetchLogs();
  }, []);

  // Danh sách nhân viên và hành động để filter
  const userList = useMemo(
    () => Array.from(new Set(logs.map(l => l.user).filter(Boolean))),
    [logs]
  );
  const actionList = useMemo(
    () => Array.from(new Set(logs.map(l => l.action).filter(Boolean))),
    [logs]
  );

  // Filter logs theo search/text/user/action/date
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      // search text
      const q = search.trim().toLowerCase();
      if (q) {
        const text = [l.action, l.note, l.user, l.orderId, l.tableId]
          .map(x => x ? x.toLowerCase() : '')
          .join(' ');
        if (!text.includes(q)) return false;
      }
      // filter user
      if (userFilter !== 'all' && l.user !== userFilter) return false;
      // filter action
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      // filter ngày
      if (dateFilter) {
        const logDate = new Date(l.timestamp).toLocaleDateString('vi-VN');
        const filterDate = new Date(dateFilter).toLocaleDateString('vi-VN');
        if (logDate !== filterDate) return false;
      }
      return true;
    });
  }, [logs, search, userFilter, actionFilter, dateFilter]);

  // Xuất Excel
  const handleExport = () => {
    const rows = filteredLogs.map(l => ({
      'Thời gian': l.timestamp ? new Date(l.timestamp).toLocaleString('vi-VN') : '',
      'Nhân viên': l.user,
      'Hành động': l.action,
      'Đơn hàng': l.orderId,
      'Bàn': l.tableId,
      'Ghi chú': l.note
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Logs');
    XLSX.writeFile(wb, 'logs.xlsx');
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 3 } }}>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        📝 Nhật ký hệ thống (Logs)
      </Typography>

      {/* Bộ lọc */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
        <TextField
          label="Tìm kiếm"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Select
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="all">Tất cả nhân viên</MenuItem>
          {userList.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
        </Select>
        <Select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="all">Tất cả thao tác</MenuItem>
          {actionList.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </Select>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={vi}>
          <DatePicker
            label="Ngày"
            value={dateFilter}
            onChange={setDateFilter}
            slotProps={{ textField: { size: 'small', sx: { minWidth: 130 } } }}
            format="dd/MM/yyyy"
            clearable
          />
        </LocalizationProvider>
        <Button variant="outlined" onClick={handleExport}>Xuất Excel</Button>
      </Stack>

      {/* Bảng logs */}
      <Paper sx={{ p: { xs: 0, sm: 2 }, overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 700 }}>
          <TableHead>
            <TableRow>
              <TableCell><strong>Thời gian</strong></TableCell>
              <TableCell><strong>Nhân viên</strong></TableCell>
              <TableCell><strong>Hành động</strong></TableCell>
              <TableCell><strong>Đơn hàng</strong></TableCell>
              <TableCell><strong>Bàn</strong></TableCell>
              <TableCell><strong>Ghi chú</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.map((log, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  {log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : ''}
                </TableCell>
                <TableCell>{log.user}</TableCell>
                <TableCell>
                  <Chip
                    label={log.action}
                    color={actionColors[log.action] || 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{log.orderCode || log.orderId || ''}</TableCell>
                <TableCell>{log.tableId || ''}</TableCell>
                <TableCell>{log.note}</TableCell>
              </TableRow>
            ))}
            {!filteredLogs.length && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>Không có log nào phù hợp.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default Logs;
