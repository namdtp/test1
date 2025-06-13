import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check active & email (nếu có users collection)
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
      const userData = userDoc.data();
      if (!userData.active) throw new Error('Tài khoản của bạn đã bị vô hiệu hóa!');
      if (userData.email !== email) throw new Error('Email không khớp với tài khoản!');

      // Điều hướng theo vai trò
      if (userData.role === 'kitchen') {
        navigate('/kitchen');
      } else if (userData.role === 'staff') {
        navigate('/staff');
      } else if (userData.role === 'manager') {
        navigate('/manager');
      } else {
        navigate('/tables'); // fallback mặc định
      }
    } else {
      navigate('/tables');
    }

      // Lưu log đăng nhập
      await addDoc(collection(db, 'logs'), {
        type: 'login',
        email: user.email || '',
        uid: user.uid,
        timestamp: Date.now(),
      });

      // Đánh dấu đã login session/tab này (chống lặp log)
      sessionStorage.setItem('loggedIn', '1');
      localStorage.setItem('loginTime', Date.now().toString());

      // Điều hướng
     // hoặc chuyển theo vai trò user nếu cần
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Đăng nhập</h2>
      <form onSubmit={handleLogin} style={styles.form}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={styles.input}
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Đăng nhập</button>
        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
};

const styles = {
  container: { maxWidth: '400px', margin: '0 auto', padding: '20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: { padding: '10px', border: '1px solid #ccc', borderRadius: '4px' },
  button: { padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  error: { color: 'red', marginTop: '10px' },
};

export default Login;
