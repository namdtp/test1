import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const TableManagement = () => {
  const [tables, setTables] = useState([]);
  const [newTableId, setNewTableId] = useState('');
  const [error, setError] = useState('');
  const [editTableId, setEditTableId] = useState(null);
  const [editTableStatus, setEditTableStatus] = useState('available');

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = () => {
    onSnapshot(collection(db, 'tables'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTables(data);
    });
  };

  const addTable = async () => {
    if (!newTableId) {
      setError('Vui lòng nhập ID bàn!');
      return;
    }

    try {
      const tableId = newTableId.toLowerCase().replace(/\s+/g, '');
      if (tables.some(table => table.id === tableId)) {
        setError('ID bàn đã tồn tại! Vui lòng chọn ID khác.');
        return;
      }

      await setDoc(doc(db, 'tables', tableId), {
        status: 'available',
        currentOrderId: null,
        total: 0,
      });

      setNewTableId('');
      setError('');
    } catch (err) {
      setError('Lỗi khi thêm bàn: ' + err.message);
    }
  };

  const startEdit = (table) => {
    setEditTableId(table.id);
    setEditTableStatus(table.status);
  };

  const saveEdit = async (tableId) => {
    try {
      await updateDoc(doc(db, 'tables', tableId), {
        status: editTableStatus,
      });

      if (editTableStatus === 'available') {
        await updateDoc(doc(db, 'tables', tableId), {
          currentOrderId: null,
          total: 0,
        });
      }

      setEditTableId(null);
      setEditTableStatus('available');
      setError('');
    } catch (err) {
      setError('Lỗi khi sửa bàn: ' + err.message);
    }
  };

  const deleteTable = async (tableId) => {
    try {
      const table = tables.find(table => table.id === tableId);
      if (table.status === 'occupied') {
        setError('Không thể xóa bàn đang có đơn hàng!');
        return;
      }

      await deleteDoc(doc(db, 'tables', tableId));
      setError('');
    } catch (err) {
      setError('Lỗi khi xóa bàn: ' + err.message);
    }
  };

  return (
    <div>
      <h3>Quản lý Bàn</h3>

      <div style={styles.form}>
        <input
          style={styles.input}
          placeholder="ID bàn (ví dụ: table3)"
          value={newTableId}
          onChange={(e) => setNewTableId(e.target.value)}
        />
        <button style={styles.button} onClick={addTable}>
          Thêm bàn
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </div>

      <h4>Danh sách Bàn</h4>
      <div style={styles.tableList}>
        {tables.length === 0 ? (
          <p>Chưa có bàn nào.</p>
        ) : (
          tables.map((table) => (
            <div key={table.id} style={styles.tableItem}>
              {editTableId === table.id ? (
                <div style={styles.editForm}>
                  <span>ID: {table.id}</span>
                  <select
                    value={editTableStatus}
                    onChange={(e) => setEditTableStatus(e.target.value)}
                    style={styles.select}
                  >
                    <option value="available">Trống</option>
                    <option value="occupied">Đã chiếm</option>
                  </select>
                  <button style={styles.button} onClick={() => saveEdit(table.id)}>
                    Lưu
                  </button>
                  <button
                    style={styles.cancelButton}
                    onClick={() => setEditTableId(null)}
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <>
                  <span>
                    Bàn {table.id}: {table.status === 'available' ? 'Trống' : 'Đã chiếm'} - Tổng: {table.total || 0} VND
                    {table.currentOrderId && ` - Đơn hàng: ${table.currentOrderId}`}
                  </span>
                  <div>
                    <button style={styles.editButton} onClick={() => startEdit(table)}>
                      Sửa
                    </button>
                    <button style={styles.deleteButton} onClick={() => deleteTable(table.id)}>
                      Xóa
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' },
  editForm: { display: 'flex', alignItems: 'center', gap: '10px' },
  input: { padding: '10px', border: '1px solid #ccc', borderRadius: '4px', flex: 1 },
  select: { padding: '10px', borderRadius: '4px' },
  button: { padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  editButton: { padding: '5px 10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' },
  deleteButton: { padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  cancelButton: { padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  tableList: { marginBottom: '20px' },
  tableItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' },
  error: { color: 'red', marginTop: '10px' },
};

export default TableManagement;