import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  Box, Typography, Accordion, AccordionSummary, AccordionDetails,
  Stack, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import './Staff.css';
import { useMenu } from '../contexts/MenuContext';
import BillPreviewKitchen from './BillPreviewKitchen'; // IMPORT COMPONENT IN BẾP

const Kitchen = () => {
  const menuList = useMenu();
  const menuMap = React.useMemo(() => {
    const map = {};
    for (const m of menuList) map[m.name] = m;
    return map;
  }, [menuList]);

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortTime, setSortTime] = useState('desc');
  const [groupType, setGroupType] = useState('table');
  const [printBillData, setPrintBillData] = useState(null); // STATE BILL IN BẾP

  // Chỉ mark đã in, không in lại các món cũ khi reload
  const printedItemsRef = useRef([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'pending')
    );
    const unsubOrders = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });
    return () => unsubOrders();
  }, []);

  const getDynamicStatus = (item) => {
    if (item.status === 'served') return 'served';
    if (item.status === 'cancel') return 'cancel';
    const now = Date.now();
    const created = parseInt(item.timestamp);
    const diff = (now - created) / 60000;
    if (diff > 15) return 'late';
    if (diff > 5) return 'pending';
    return 'new';
  };

  const updateItemStatus = async (orderId, itemIndex) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const updatedItems = [...order.items];
    updatedItems[itemIndex].status = 'served';
    await import('firebase/firestore').then(({ updateDoc, doc }) =>
      updateDoc(doc(db, 'orders', orderId), { items: updatedItems })
    );
  };

  // Danh sách món chờ xử lý, gán thêm thông tin order/table cho từng item
  const allItems = orders.flatMap(order =>
    order.items.map((item, index) => ({
      ...item,
      orderId: order.id,
      itemIndex: index,
      tableId: order.tableId,
      orderCode: order.orderCode
    }))
  ).filter(item =>
    item.status !== 'cancel'
  );

  // Mark đã in hết các món pending khi mở trang lần đầu (KHÔNG in!)
  useEffect(() => {
    if (!initializedRef.current && allItems.length > 0) {
      printedItemsRef.current = allItems
        .filter(item => item.status === 'pending')
        .map(item => ({ orderId: item.orderId, itemIndex: item.itemIndex }));
      initializedRef.current = true;
    }
  }, [allItems]);

  // Khi có món mới (pending, chưa in), thì in bằng BillPreviewKitchen
  useEffect(() => {
    if (!initializedRef.current) return;
    // Lọc các món mới chưa in
    const newItems = allItems.filter(
      item =>
        item.status === 'pending' &&
        !printedItemsRef.current.some(
          pi => pi.orderId === item.orderId && pi.itemIndex === item.itemIndex
        )
    );
    if (newItems.length > 0 && !printBillData) {
      // Group các món mới theo order (mỗi bàn 1 bill riêng)
      const grouped = {};
      newItems.forEach(item => {
        if (!grouped[item.orderId]) grouped[item.orderId] = [];
        grouped[item.orderId].push(item);
      });
      // In lần lượt từng bill (nếu có nhiều bàn cùng gọi)
      const orderIds = Object.keys(grouped);
      if (orderIds.length > 0) {
        const orderId = orderIds[0]; // lấy từng order/bill một
        const order = orders.find(o => o.id === orderId);
        if (order) {
          setPrintBillData({ order, itemsBill: grouped[orderId] });
        }
      }
      // Note: các món sẽ được đánh dấu đã in khi printBillData in xong
    }
    // eslint-disable-next-line
  }, [allItems, menuMap, orders, printBillData]);

  // Khi in xong, đánh dấu các món đã in (chỉ khi BillPreviewKitchen gọi xong)
  const handlePrintDone = () => {
    if (printBillData && printBillData.itemsBill) {
      printedItemsRef.current = [
        ...printedItemsRef.current,
        ...printBillData.itemsBill.map(i => ({
          orderId: printBillData.order.id,
          itemIndex: i.itemIndex
        }))
      ];
    }
    setPrintBillData(null);
  };

  // FILTER + SORT
  let filteredItems = allItems.filter(item => {
    if (statusFilter !== 'all' && getDynamicStatus(item) !== statusFilter) return false;
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'custom' && !item.isCustom) return false;
      if (
        categoryFilter !== 'custom'
        && (menuMap[item.name]?.category || '').toLowerCase() !== categoryFilter.toLowerCase()
        && !(!menuMap[item.name] && categoryFilter === 'custom')
      ) return false;
    }
    return true;
  });

  filteredItems.sort((a, b) =>
    sortTime === 'desc'
      ? b.timestamp - a.timestamp
      : a.timestamp - b.timestamp
  );

  // GROUP BY BÀN
  const groupedByTable = filteredItems.reduce((acc, item) => {
    if (!acc[item.tableId]) acc[item.tableId] = [];
    acc[item.tableId].push(item);
    return acc;
  }, {});

  const allCategories = [
    ...new Set(menuList.map(m => (m.category || '').trim()).filter(Boolean))
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1000px', mx: 'auto' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        👨‍🍳 Món đang chờ bếp ({filteredItems.length} món)
      </Typography>

      {/* FILTERS */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Nhóm theo</InputLabel>
          <Select value={groupType} label="Nhóm theo" onChange={e => setGroupType(e.target.value)}>
            <MenuItem value="table">Bàn</MenuItem>
            <MenuItem value="dish">Món</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 140 }}>
          <InputLabel>Trạng thái</InputLabel>
          <Select value={statusFilter} label="Trạng thái" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="new">Mới</MenuItem>
            <MenuItem value="pending">Đang chờ</MenuItem>
            <MenuItem value="late">Quá lâu</MenuItem>
            <MenuItem value="served">Đã xong</MenuItem>
            <MenuItem value="cancel">Đã huỷ</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 140 }}>
          <InputLabel>Loại món</InputLabel>
          <Select value={categoryFilter} label="Loại món" onChange={e => setCategoryFilter(e.target.value)}>
            <MenuItem value="all">Tất cả</MenuItem>
            {allCategories.map(cat =>
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            )}
            <MenuItem value="custom">Ngoài menu</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Sắp xếp</InputLabel>
          <Select value={sortTime} label="Sắp xếp" onChange={e => setSortTime(e.target.value)}>
            <MenuItem value="desc">Mới nhất</MenuItem>
            <MenuItem value="asc">Cũ nhất</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* Hiển thị theo kiểu groupType */}
      {groupType === 'table' ? (
        Object.entries(groupedByTable).length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>Không có món nào phù hợp filter.</Typography>
        ) : (
          Object.entries(groupedByTable).map(([tableId, items]) => (
            <Accordion key={tableId} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">🪑 Bàn {tableId} ({items.length} món)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ overflowX: 'auto' }}>
                  <table className="staff-table">
                    <thead>
                      <tr>
                        <th>MÓN</th>
                        <th>TRẠNG THÁI</th>
                        <th>LOẠI</th>
                        <th>SỐ LƯỢNG</th>
                        <th>THỜI GIAN / GHI CHÚ</th>
                        <th>BÀN</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const dynamicStatus = getDynamicStatus(item);
                        return (
                          <tr key={idx}>
                            <td>
                              {item.name}
                              {item.isCustom && (
                                <span style={{ color: '#f57c00', fontSize: 12, marginLeft: 4 }} title="Món ngoài menu">(tự nhập)</span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`status-chip status-${dynamicStatus}`}
                                style={{ cursor: item.status === 'pending' ? 'pointer' : 'default' }}
                                onClick={() => {
                                  if (item.status === 'pending') {
                                    updateItemStatus(item.orderId, item.itemIndex);
                                  }
                                }}
                              >
                                {{
                                  new: 'Mới',
                                  pending: 'Đang chờ',
                                  late: 'Quá lâu',
                                  served: 'Đã xong',
                                  cancel: 'Đã huỷ'
                                }[dynamicStatus]}
                              </span>
                            </td>
                            <td>
                              {item.isCustom ? 'Ngoài menu' : (menuMap[item.name]?.category || '---')}
                            </td>
                            <td>{item.quantity}</td>
                            <td>
                              {item.note || new Date(item.timestamp).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td>
                              {item.tableId}
                            </td>
                            <td></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))
        )
      ) : (
        <Box sx={{ overflowX: 'auto', mt: 2 }}>
          <table className="staff-table">
            <thead>
              <tr>
                <th>MÓN</th>
                <th>TRẠNG THÁI</th>
                <th>LOẠI</th>
                <th>SỐ LƯỢNG</th>
                <th>THỜI GIAN / GHI CHÚ</th>
                <th>BÀN</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center' }}>Không có món nào phù hợp filter.</td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const dynamicStatus = getDynamicStatus(item);
                  return (
                    <tr key={idx}>
                      <td>
                        {item.name}
                        {item.isCustom && (
                          <span style={{ color: '#f57c00', fontSize: 12, marginLeft: 4 }} title="Món ngoài menu">(tự nhập)</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-chip status-${dynamicStatus}`}
                          style={{ cursor: item.status === 'pending' ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (item.status === 'pending') {
                              updateItemStatus(item.orderId, item.itemIndex);
                            }
                          }}
                        >
                          {{
                            new: 'Mới',
                            pending: 'Đang chờ',
                            late: 'Quá lâu',
                            served: 'Đã xong',
                            cancel: 'Đã huỷ'
                          }[dynamicStatus]}
                        </span>
                      </td>
                      <td>
                        {item.isCustom ? 'Ngoài menu' : (menuMap[item.name]?.category || '---')}
                      </td>
                      <td>{item.quantity}</td>
                      <td>
                        {item.note || new Date(item.timestamp).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td>
                        {item.tableId}
                      </td>
                      <td></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Box>
      )}

      {/* BillPreviewKitchen chỉ render khi cần in món mới */}
      {printBillData && (
        <BillPreviewKitchen
          order={printBillData.order}
          itemsBill={printBillData.itemsBill}
          onDone={handlePrintDone}
          printer="bep"
        />
      )}
    </Box>
  );
};

export default Kitchen;
