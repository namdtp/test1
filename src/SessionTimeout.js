import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebaseConfig';

const SESSION_TIMEOUT = 4 * 60 * 60 * 1000;

export default function SessionTimeout({ user }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      const loginTime = parseInt(localStorage.getItem('loginTime') || '0', 10);
      if (loginTime && Date.now() - loginTime > SESSION_TIMEOUT) {
        auth.signOut();
        localStorage.removeItem('loginTime');
        navigate('/login');
      }
    }, 60 * 1000); // check mỗi phút
    return () => clearInterval(timer);
  }, [user, navigate]);

  return null;
}
