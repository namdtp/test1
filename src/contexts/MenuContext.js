import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from '../firebaseConfig';

const MenuContext = createContext([]);

export const MenuProvider = ({ children }) => {
  const [user, loading] = useAuthState(auth);
  const [menuList, setMenuList] = useState([]);

  useEffect(() => {
    if (!loading && user) {
      // Chỉ fetch Firestore khi user đã login!
      const unsub = onSnapshot(collection(db, 'menu'), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMenuList(data);
      });
      return () => unsub();
    } else {
      setMenuList([]); // Khi logout thì clear menuList
    }
  }, [user, loading]);

  return (
    <MenuContext.Provider value={menuList}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => useContext(MenuContext);
