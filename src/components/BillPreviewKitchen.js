// BillPreviewKitchen.js
import React, { useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';

const BillPreviewKitchen = ({ order, itemsBill, onDone, printer = 'bep' }) => {
  const ref = useRef();

  // Hàm gửi ảnh PNG lên server máy in bếp
  const sendToPrinter = async (blob) => {
    console.log('[BillPreviewKitchen] Chuẩn bị gửi ảnh lên server máy in:', { printer });
    const formData = new FormData();
    formData.append('file', blob, 'kitchen-bill.png');
    formData.append('printer', printer);
    try {
      const res = await fetch('http://192.168.1.200:3000/print/image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      console.log('[BillPreviewKitchen] Gửi ảnh lên server thành công', data);
    } catch (err) {
      console.error('[BillPreviewKitchen] Lỗi gửi ảnh lên server:', err);
    }
    if (onDone) onDone();
  };

  useEffect(() => {
    if (!ref.current) return;
    setTimeout(() => {

    const imgs = ref.current.querySelectorAll('img');
    imgs.forEach(el => el.parentNode && el.parentNode.removeChild(el));
      // REMOVE SVG & PATH khỏi bill trước khi gọi html2canvas!
      const svgs = ref.current.querySelectorAll('svg, path');
      svgs.forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      // Log lại DOM đã được xóa SVG
      console.log('[BillPreviewKitchen] outerHTML after REMOVE:', ref.current?.outerHTML);

      html2canvas(ref.current, {
        backgroundColor: '#fff',
        scale: 2,
        useCORS: true,
      }).then(canvas => {
        console.log('[BillPreviewKitchen] Đã chuyển hóa đơn thành ảnh PNG');
        canvas.toBlob((blob) => {
          console.log('[BillPreviewKitchen] toBlob trả về:', blob);
          if (blob) sendToPrinter(blob);
          else console.error('[BillPreviewKitchen] toBlob trả về null, không gửi được!');
        }, 'image/png');
      });
    }, 400);
  }, [order, itemsBill, printer]);




  // ====== Giao diện phiếu bếp ======
  return (
    // <div ref={ref} style={{width:200, height:100, background:'#fff'}}>
    //   Test Bill!
    // </div>

    <div
      ref={ref}
      style={{
        width: 286,
        minHeight: 50,
        margin: '0px auto',
        padding: 0,
        fontFamily: 'monospace, Roboto, Arial',
        background: '#fff',
        color: '#000',
        fontSize: 13,
        border: '1px solid #eee',
        boxSizing: 'border-box',
      }}
    >
       <style>
        {`svg, path { display: none !important; }`}
      </style>
      {/* Bàn - Giờ: Cùng 1 dòng, nhỏ gọn, sát lề */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 15,
          fontWeight: 700,
          margin: 0,
          padding: 0,
          lineHeight: 1.1,
        }}
      >
        <span>
          Bàn: <b>{order.tableId}</b>
        </span>
        <span>
          Giờ:{' '}
          <b>
            {order.createdAt
              ? new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </b>
        </span>
      </div>
      {/* Tiêu đề phiếu bếp: nhỏ hơn, sát ngay bên dưới */}
      {/* Bảng món: tiết kiệm giấy */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          margin: 0,
          fontSize: 13,
          border: '1px solid #333',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '2px 0 2px 2px',
                border: '1px solid #333',
                background: '#f4f4f4',
                fontWeight: 700,
              }}
            >
              Món
            </th>
            <th
              style={{
                textAlign: 'center',
                width: 32,
                padding: '2px 0',
                border: '1px solid #333',
                background: '#f4f4f4',
                fontWeight: 700,
              }}
            >
              SL
            </th>
            <th
              style={{
                textAlign: 'left',
                width: 70,
                padding: '2px 0 2px 2px',
                border: '1px solid #333',
                background: '#f4f4f4',
                fontWeight: 700,
              }}
            >
              Ghi chú
            </th>
          </tr>
        </thead>
        <tbody>
          {itemsBill.map((item, idx) => (
            <tr key={idx}>
              <td
                style={{
                  fontWeight: 600,
                  padding: '2px 0 2px 2px',
                  border: '1px solid #333',
                  wordBreak: 'break-word',
                }}
              >
                {item.name}
              </td>
              <td
                style={{
                  textAlign: 'center',
                  border: '1px solid #333',
                }}
              >
                {item.quantity}
              </td>
              <td
                style={{
                  color: '#b00',
                  fontWeight: item.note ? 600 : 400,
                  border: '1px solid #333',
                  padding: '2px 0 2px 2px',
                }}
              >
                {item.note || ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Thời gian in: nhỏ, sát dưới */}
      <div
        style={{
          fontSize: 11,
          textAlign: 'right',
          margin: 0,
          marginTop: 2,
          color: '#666',
        }}
      >
        In lúc:{' '}
        {new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}
      </div>
    </div>
  );
};

export default BillPreviewKitchen;
