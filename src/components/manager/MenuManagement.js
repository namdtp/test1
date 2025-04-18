import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemAvailable, setNewItemAvailable] = useState(true);
  const [editItemId, setEditItemId] = useState(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editItemAvailable, setEditItemAvailable] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = () => {
    onSnapshot(collection(db, 'menu'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMenuItems(data);
    });
  };

  const addMenuItem = async () => {
    if (!newItemName || !newItemPrice || !newItemCategory) {
      setError('Vui lòng nhập đầy đủ tên món, giá và danh mục!');
      return;
    }

    const price = parseInt(newItemPrice);
    if (isNaN(price) || price <= 0) {
      setError('Giá phải là một số lớn hơn 0!');
      return;
    }

    try {
      const docId = newItemName.toLowerCase().replace(/\s+/g, '_');
      if (menuItems.some(item => item.id === docId)) {
        setError('Món ăn đã tồn tại! Vui lòng chọn tên khác.');
        return;
      }

      await setDoc(doc(db, 'menu', docId), {
        name: newItemName,
        price: price,
        category: newItemCategory,
        available: newItemAvailable,
      });
      setNewItemName('');
      setNewItemPrice('');
      setNewItemCategory('');
      setNewItemAvailable(true);
      setError('');
    } catch (err) {
      setError('Lỗi khi thêm món: ' + err.message);
    }
  };

  const startEdit = (item) => {
    setEditItemId(item.id);
    setEditItemName(item.name);
    setEditItemPrice(item.price.toString());
    setEditItemCategory(item.category);
    setEditItemAvailable(item.available);
  };

  const saveEdit = async () => {
    if (!editItemName || !editItemPrice || !editItemCategory) {
      setError('Vui lòng nhập đầy đủ tên món, giá và danh mục!');
      return;
    }

    const price = parseInt(editItemPrice);
    if (isNaN(price) || price <= 0) {
      setError('Giá phải là một số lớn hơn 0!');
      return;
    }

    try {
      const newDocId = editItemName.toLowerCase().replace(/\s+/g, '_');
      if (newDocId !== editItemId && menuItems.some(item => item.id === newDocId)) {
        setError('Tên món đã tồn tại! Vui lòng chọn tên khác.');
        return;
      }

      await setDoc(doc(db, 'menu', newDocId), {
        name: editItemName,
        price: price,
        category: editItemCategory,
        available: editItemAvailable,
      });

      if (newDocId !== editItemId) {
        await deleteDoc(doc(db, 'menu', editItemId));
      }

      setEditItemId(null);
      setEditItemName('');
      setEditItemPrice('');
      setEditItemCategory('');
      setEditItemAvailable(true);
      setError('');
    } catch (err) {
      setError('Lỗi khi sửa món: ' + err.message);
    }
  };

  const deleteMenuItem = async (id) => {
    try {
      await deleteDoc(doc(db, 'menu', id));
      setError('');
    } catch (err) {
      setError('Lỗi khi xóa món: ' + err.message);
    }
  };

  return (
    <div>
      <h3>Quản lý Menu</h3>
      <div style={styles.form}>
        <input
          style={styles.input}
          placeholder="Tên món"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
        />
        <input
          style={styles.input}
          type="number"
          placeholder="Giá (VND)"
          value={newItemPrice}
          onChange={(e) => setNewItemPrice(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="Danh mục (food/drink)"
          value={newItemCategory}
          onChange={(e) => setNewItemCategory(e.target.value)}
        />
        <label>
          Có sẵn:
          <input
            type="checkbox"
            checked={newItemAvailable}
            onChange={(e) => setNewItemAvailable(e.target.checked)}
          />
        </label>
        <button style={styles.button} onClick={addMenuItem}>
          Thêm món
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </div>

      <h4>Danh sách Menu</h4>
      <div style={styles.menuList}>
        {menuItems.map((item) => (
          <div key={item.id} style={styles.menuItem}>
            {editItemId === item.id ? (
              <div style={styles.editForm}>
                <input
                  style={styles.input}
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                />
                <input
                  style={styles.input}
                  type="number"
                  value={editItemPrice}
                  onChange={(e) => setEditItemPrice(e.target.value)}
                />
                <input
                  style={styles.input}
                  value={editItemCategory}
                  onChange={(e) => setEditItemCategory(e.target.value)}
                />
                <label>
                  Có sẵn:
                  <input
                    type="checkbox"
                    checked={editItemAvailable}
                    onChange={(e) => setEditItemAvailable(e.target.checked)}
                  />
                </label>
                <button style={styles.button} onClick={saveEdit}>
                  Lưu
                </button>
                <button
                  style={styles.cancelButton}
                  onClick={() => setEditItemId(null)}
                >
                  Hủy
                </button>
              </div>
            ) : (
              <>
                <span>{`${item.name}: ${item.price} VND - ${item.category} - ${item.available ? 'Có sẵn' : 'Hết hàng'}`}</span>
                <div>
                  <button style={styles.editButton} onClick={() => startEdit(item)}>
                    Sửa
                  </button>
                  <button style={styles.deleteButton} onClick={() => deleteMenuItem(item.id)}>
                    Xóa
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' },
  editForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: { padding: '10px', border: '1px solid #ccc', borderRadius: '4px', flex: 1 },
  button: { padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  editButton: { padding: '5px 10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' },
  deleteButton: { padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  cancelButton: { padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  menuList: { marginBottom: '20px' },
  menuItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' },
  error: { color: 'red', marginTop: '10px' },
};

export default MenuManagement;