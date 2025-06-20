import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  Box, Typography, Stack, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';

import './Kitchen.css';
import { useMenu } from '../contexts/MenuContext';
import BillPreviewKitchen from './BillPreviewKitchen';

const Kitchen = () => {
  const menuList = useMenu();
  const menuMap = React.useMemo(() => {
    const map = {};
    for (const m of menuList) map[m.name] = m;
    return map;
  }, [menuList]);
  const [openGroup, setOpenGroup] = useState({});

  const [groupBy, setGroupBy] = useState('table');
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('not-served');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortTime, setSortTime] = useState('desc');
  const [printBillData, setPrintBillData] = useState(null);

  const printedItemsRef = useRef([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
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

  const allItems = orders.flatMap(order =>
    order.items.map((item, index) => ({
      ...item,
      orderId: order.id,
      itemIndex: index,
      tableId: order.tableId,
      orderCode: order.orderCode
    }))
  ).filter(item => item.status !== 'cancel');

  useEffect(() => {
    if (!initializedRef.current && allItems.length > 0) {
      printedItemsRef.current = allItems
        .filter(item => item.status === 'pending')
        .map(item => ({ orderId: item.orderId, itemIndex: item.itemIndex }));
      initializedRef.current = true;
    }
  }, [allItems]);

  useEffect(() => {
    if (!initializedRef.current) return;
    const newItems = allItems.filter(
      item =>
        item.status === 'pending' &&
        !printedItemsRef.current.some(
          pi => pi.orderId === item.orderId && pi.itemIndex === item.itemIndex
        )
    );
    if (newItems.length > 0 && !printBillData) {
      const grouped = {};
      newItems.forEach(item => {
        if (!grouped[item.orderId]) grouped[item.orderId] = [];
        grouped[item.orderId].push(item);
      });
      const orderIds = Object.keys(grouped);
      if (orderIds.length > 0) {
        const orderId = orderIds[0];
        const order = orders.find(o => o.id === orderId);
        if (order) {
          console.log('[Kitchen] Có món mới cần in:', { order, itemsBill: grouped[orderId] });
          setPrintBillData({ order, itemsBill: grouped[orderId] });
        }
      }
    }
  }, [allItems, menuMap, orders, printBillData]);

  const handlePrintDone = () => {
    if (printBillData?.itemsBill) {
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

  let filteredItems = allItems.filter(item => {
    const status = getDynamicStatus(item);
    if (statusFilter !== 'all') {
      if (statusFilter === 'not-served') {
        const valid = ['new', 'pending', 'late'];
        if (!valid.includes(status)) return false;
      } else if (status !== statusFilter) {
        return false;
      }
    }
    if (categoryFilter !== 'all') {
      const cat = (menuMap[item.name]?.category || '').toLowerCase();
      if (categoryFilter === 'custom' && !item.isCustom) return false;
      if (categoryFilter !== 'custom' && cat !== categoryFilter.toLowerCase()) return false;
    }
    return true;
  });

  filteredItems.sort((a, b) =>
    sortTime === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
  );

  // Group by table
  const groupedByTable = filteredItems.reduce((acc, item) => {
    if (!acc[item.tableId]) acc[item.tableId] = [];
    acc[item.tableId].push(item);
    return acc;
  }, {});

  // Group by dish
  const groupedByDish = {};
  filteredItems.forEach(item => {
    if (!groupedByDish[item.name]) groupedByDish[item.name] = [];
    groupedByDish[item.name].push(item);
  });

  // Group by groupName
  const groupedByGroup = {};
  filteredItems.forEach(item => {
    const group = menuMap[item.name]?.groupName || 'Chưa phân nhóm';
    if (!groupedByGroup[group]) groupedByGroup[group] = [];
    groupedByGroup[group].push(item);
  });

  const allCategories = [...new Set(menuList.map(m => (m.category || '').trim()).filter(Boolean))];

  return (
    <Box sx={{ p: 3, maxWidth: '100%' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        👨‍🍳 Món đang chờ bếp ({filteredItems.length} món)
      </Typography>

      <Stack direction="row" spacing={2} mb={3}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Nhóm theo</InputLabel>
          <Select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
            <MenuItem value="table">Bàn</MenuItem>
            <MenuItem value="dish">Món</MenuItem>
            <MenuItem value="group">Nhóm món</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 140 }}>
          <InputLabel>Trạng thái</InputLabel>
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="new">Mới</MenuItem>
            <MenuItem value="pending">Đang chờ</MenuItem>
            <MenuItem value="late">Quá lâu</MenuItem>
            <MenuItem value="not-served">Chưa phục vụ</MenuItem>
            <MenuItem value="served">Đã xong</MenuItem>
            <MenuItem value="cancel">Đã huỷ</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 140 }}>
          <InputLabel>Loại món</InputLabel>
          <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <MenuItem value="all">Tất cả</MenuItem>
            {allCategories.map(cat => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
            <MenuItem value="custom">Ngoài menu</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Sắp xếp</InputLabel>
          <Select value={sortTime} onChange={e => setSortTime(e.target.value)}>
            <MenuItem value="desc">Mới nhất</MenuItem>
            <MenuItem value="asc">Cũ nhất</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* Group by Table */}
      {groupBy === 'table' && Object.keys(groupedByTable).length > 0 ? (
        <Box sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 2,
          width: '100%',
        }}>
           {Object.entries(groupedByTable).map(([tableId, items]) => (
            <Box
              key={tableId}
              sx={{
                minWidth: 320,
                maxWidth: 800,
                width: 700,
                flex: '0 0 auto',
                border: '1px solid #ccc',
                borderRadius: 2,
                p: 2,
                backgroundColor: '#fff',
                mb: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 670,      // <= chỉnh lại chiều cao tùy ý
              }}
            >
              <Typography fontWeight="bold" mb={1}>
                🪑 Bàn {tableId} ({items.length} món)
              </Typography>
              <Box sx={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
              }}>
                <table className="kitchen-table" style={{
                  width: '100%',
                  tableLayout: 'fixed',
                  marginBottom: 0,
                }}>
                  <thead>
                    <tr>
                      <th style={{ width: '34%' }}>MÓN</th>
                      <th style={{ width: '12%' }}>SL</th>
                      <th style={{ width: '28%' }}>TRẠNG</th>
                      <th style={{ width: '26%' }}>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const dynamicStatus = getDynamicStatus(item);
                      return (
                        <tr key={idx}>
                          <td style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.name}
                            {item.isCustom && (
                              <span style={{ color: '#f57c00', fontSize: 12, marginLeft: 4 }}>
                                (tự nhập)
                              </span>
                            )}
                          </td>
                          <td>{item.quantity}</td>
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
                          <td style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.timestamp
                              ? new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </Box>
          ))}
        </Box>

      /* Group by Dish */
      ) : groupBy === 'dish' && Object.keys(groupedByDish).length > 0 ? (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            md: '1fr 1fr 1fr',
            lg: '1fr 1fr 1fr 1fr'
          },
          gap: 2,
          alignItems: 'flex-start',
          width: '100%',
        }}>
          {Object.entries(groupedByDish).map(([dishName, items]) => (
            <Box
              key={dishName}
              sx={{
                minWidth: 320,
                maxWidth: 370,
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: 2,
                p: 2,
                backgroundColor: '#fff',
                mb: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Typography
                fontWeight="bold"
                mb={1}
                sx={{
                  color: '#1976d2',
                  wordBreak: 'break-word',
                  fontSize: 17,
                  minHeight: 34,
                }}
              >
                🍽️ {dishName}
              </Typography>
              <table className="kitchen-table" style={{
                width: '100%',
                tableLayout: 'fixed',
                marginBottom: 0,
              }}>
                <thead>
                  <tr>
                    <th style={{ width: '34%' }}>Bàn</th>
                    <th style={{ width: '12%' }}>SL</th>
                    <th style={{ width: '28%' }}>Trạng thái</th>
                    <th style={{ width: '26%' }}>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.tableId + '-' + idx}>
                      <td style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>Bàn {item.tableId}</td>
                      <td>{item.quantity}</td>
                      <td>
                        <span
                          className={`status-chip status-${getDynamicStatus(item)}`}
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
                          }[getDynamicStatus(item)]}
                        </span>
                      </td>
                      <td style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.timestamp
                          ? new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          ))}
        </Box>

      /* Group by Group */
      ) : groupBy === 'group' && Object.keys(groupedByGroup).length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 1fr 1fr',
              lg: '1fr 1fr 1fr 1fr'
            },
            gap: 2,
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          {Object.entries(groupedByGroup).map(([group, items]) => (
            <Box
              key={group}
              sx={{
                minWidth: 350,
                maxWidth: 400,
                width: '100%',
                border: '1px solid #ccc',
                borderRadius: 2,
                p: 2,
                backgroundColor: '#fff',
                mb: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header group: click toàn bộ để toggle */}
              <Box
                onClick={() => setOpenGroup(s => ({ ...s, [group]: !s[group] }))}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1,
                  cursor: 'pointer',
                  userSelect: 'none',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  transition: 'background 0.2s',
                  '&:hover': {
                    background: '#f5f5f5',
                  }
                }}
              >
                <Typography
                  fontWeight="bold"
                  sx={{
                    color: '#d2691e',
                    wordBreak: 'break-word',
                    fontSize: 17,
                    minHeight: 34,
                  }}
                >
                  {group}
                </Typography>

              </Box>

              {/* Content collapse */}
              {openGroup[group] && (
                Array.from(new Set(items.map(i => i.name))).map(dishName => (
                  <Box key={dishName} sx={{ mb: 2 }}>
                    <Typography fontWeight={600} sx={{ mb: 1, color: '#1976d2', fontSize: 15 }}>
                      {dishName}
                    </Typography>
                    <table className="kitchen-table" style={{
                      width: '100%',
                      tableLayout: 'fixed',
                      marginBottom: 0,
                    }}>
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>Bàn</th>
                          <th style={{ width: '12%' }}>SL</th>
                          <th style={{ width: '32%' }}>Trạng thái</th>
                          <th style={{ width: '26%' }}>Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter(i => i.name === dishName).map((item, idx) => (
                          <tr key={item.tableId + '-' + idx}>
                            <td style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>Bàn {item.tableId}</td>
                            <td>{item.quantity}</td>
                            <td>
                              <span
                                className={`status-chip status-${getDynamicStatus(item)}`}
                                style={{ cursor: item.status === 'pending' ? 'pointer' : 'default', marginLeft: 6 }}
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
                                }[getDynamicStatus(item)]}
                              </span>
                            </td>
                            <td style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {item.timestamp
                                ? new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                ))
              )}
            </Box>
          ))}


        </Box>
      ) : (
        <Typography color="text.secondary">Không có món nào phù hợp filter.</Typography>
      )}

      {printBillData && (
        <div style={{ visibility: 'hidden', position: 'absolute', left: -9999, top: 0 }}>
          <BillPreviewKitchen
            order={printBillData.order}
            itemsBill={printBillData.itemsBill}
            onDone={handlePrintDone}
            printer="bep"
          />
        </div>
      )}
    </Box>
  );
};

export default Kitchen;
