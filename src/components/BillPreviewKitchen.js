// BillPreviewKitchen.js
import React, { useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';

const BillPreviewKitchen = ({ order, itemsBill, onDone, printer = 'bep' }) => {
  const ref = useRef();

  // Hàm gửi ảnh PNG lên server máy in bếp
  const sendToPrinter = async (blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'kitchen-bill.png');
    formData.append('printer', printer);
    try {
    //   await fetch('http://192.168.1.200:3000/print/image', {   // <== SỬA ĐÚNG IP TẠI ĐÂY!
        await fetch('http://localhost:3000/print/image', {
        method: 'POST',
        body: formData,
      });
    } catch (err) {
      // Có thể báo lỗi ở đây nếu muốn
    }
    if (onDone) onDone();
  };

  useEffect(() => {
    if (!ref.current) return;
    setTimeout(async () => {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#fff',
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob((blob) => {
        if (blob) sendToPrinter(blob);
      }, 'image/png');
    }, 400);
    // eslint-disable-next-line
  }, []);

  // ====== Giao diện phiếu bếp ======
  return (
    <div style={{ position: 'fixed', left: -9999, top: 0, zIndex: -1 }}>
      <div
        ref={ref}
        style={{
          width: 340,
          minHeight: 170,
          padding: 20,
          fontFamily: 'monospace, Roboto, Arial',
          background: '#fff',
          color: '#000',
          fontSize: 20,
          border: '1px solid #eee',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 28, letterSpacing: 2 }}>PHIẾU BẾP</b>
        </div>
        <div style={{ marginBottom: 5, fontSize: 17 }}>
          <b>Bàn:</b> {order.tableId || '--'} &nbsp;&nbsp;
          <b>Mã:</b> {order.orderCode || order.id}
        </div>
        <div style={{ marginBottom: 5, fontSize: 17 }}>
          <b>Giờ:</b> {new Date(order.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 17, paddingBottom: 2 }}>Món</th>
              <th style={{ textAlign: 'center', width: 38, fontSize: 17, paddingBottom: 2 }}>SL</th>
              <th style={{ textAlign: 'left', width: 90, fontSize: 17, paddingBottom: 2 }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {itemsBill.map((item, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 'bold', fontSize: 19, padding: '4px 0' }}>{item.name}</td>
                <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 19 }}>{item.quantity}</td>
                <td style={{ fontSize: 16, color: '#2d2d2d' }}>{item.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 13, textAlign: 'center', marginTop: 16, color: '#666' }}>
          In lúc: {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default BillPreviewKitchen;
