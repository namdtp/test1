import React, { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';

export default function BillPreview({ order, menuMap = {}, options = {} }) {
  const {
    itemsBill = null,
    discount = 0,
    extraFee = 0,
    customerName = '',
    note = '',
    showVietQR = true,
    printNow = false,
    printer = 'bar',
    onDone = () => {},
    onError = () => {}
  } = options;

  const billRef = useRef();
  const qrRef = useRef();

  const items = itemsBill || (order.items || []).filter(i => i.status !== 'cancel');
  const subtotal = items.reduce((sum, item) => {
    const price = menuMap[item.name]?.price ?? item.price ?? 0;
    return sum + price * item.quantity;
  }, 0);
  const total = subtotal - discount + extraFee;

  // ----- QR qua proxy weserv (chống CORS tuyệt đối) -----
  const bankBin = '970403';
  const account = 'TNG50523114517';
  const addInfo = encodeURIComponent(order.orderCode || order.id);
  const vietqrUrl = "https://images.weserv.nl/?url=" + encodeURIComponent(
    `img.vietqr.io/image/${bankBin}-${account}-print.png?amount=${total}&addInfo=${addInfo}`
  );

  // ----- Nếu muốn test PNG public (comment QR thật, bỏ comment dòng dưới) -----
  // const vietqrUrl = "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png";

  const waitImageLoad = () => {
    return new Promise(resolve => {
      if (!qrRef.current) return resolve();
      if (qrRef.current.complete) return resolve();
      const onLoad = () => {
        qrRef.current && (qrRef.current.onload = null);
        qrRef.current && (qrRef.current.onerror = null);
        resolve();
      };
      qrRef.current.onload = onLoad;
      qrRef.current.onerror = onLoad;
    });
  };

  const sendToPrint = async () => {
    try {
      await waitImageLoad();
      console.log("QR image loaded:", qrRef.current?.src, qrRef.current?.complete);

      const canvas = await html2canvas(billRef.current, { scale: 2, useCORS: true });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const formData = new FormData();
      formData.append('file', blob, 'bill.png');
      formData.append('printer', printer);

      await fetch('http://192.168.1.200:3000/print/image', {
        method: 'POST',
        body: formData
      });

      onDone();
    } catch (err) {
      console.error('❌ Lỗi khi gửi ảnh in:', err);
      onError();
    }
  };

  useEffect(() => {
    if (printNow) {
      setTimeout(() => sendToPrint(), 500); // đợi DOM render
    }
    // eslint-disable-next-line
  }, [printNow]);

  return (
    <div style={{ padding: 16 }}>
      <div ref={billRef} style={{
        width: 300,
        padding: 12,
        backgroundColor: '#fff',
        fontFamily: 'Roboto, sans-serif',
        color: '#000',
        fontSize: 12
      }}>
        <h3 style={{ textAlign: 'center', margin: '4px 0' }}>HÓA ĐƠN THANH TOÁN</h3>
        <p><b>Bàn:</b> {order.tableId}</p>
        <p><b>Mã đơn:</b> {order.orderCode || order.id}</p>
        <p><b>Thời gian:</b> {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
        {customerName && <p><b>Khách:</b> {customerName}</p>}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead>
            <tr>
              <th>Món</th>
              <th style={{ textAlign: 'center' }}>SL</th>
              <th style={{ textAlign: 'right' }}>Đơn giá</th>
              <th style={{ textAlign: 'right' }}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const price = menuMap[item.name]?.price ?? item.price ?? 0;
              return (
                <tr key={idx}>
                  <td>{item.name}</td>
                  <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{price.toLocaleString('vi-VN')}₫</td>
                  <td style={{ textAlign: 'right' }}>{(item.quantity * price).toLocaleString('vi-VN')}₫</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Tạm tính</td>
              <td style={{ textAlign: 'right' }}>{subtotal.toLocaleString('vi-VN')}₫</td>
            </tr>
            {discount > 0 && (
              <tr>
                <td colSpan={3}>Giảm giá</td>
                <td style={{ textAlign: 'right' }}>- {discount.toLocaleString('vi-VN')}₫</td>
              </tr>
            )}
            {extraFee > 0 && (
              <tr>
                <td colSpan={3}>Phụ thu</td>
                <td style={{ textAlign: 'right' }}>+ {extraFee.toLocaleString('vi-VN')}₫</td>
              </tr>
            )}
            <tr style={{ fontWeight: 'bold', borderTop: '1px solid #000' }}>
              <td colSpan={3}>TỔNG CỘNG</td>
              <td style={{ textAlign: 'right' }}>{total.toLocaleString('vi-VN')}₫</td>
            </tr>
          </tfoot>
        </table>

        {note && <p><b>Ghi chú:</b> {note}</p>}

        {showVietQR && (
          <div style={{ textAlign: 'center', margin: '12px 0' }}>
            <b>Chuyển khoản VietQR:</b><br />
            <img
              ref={qrRef}
              src={vietqrUrl}
              alt="vietqr"
              style={{ width: 220, margin: '8px auto' }}
              crossOrigin="anonymous"
            />
            <div style={{ fontSize: 11 }}>
              Nội dung: <b>{decodeURIComponent(addInfo)}</b><br />
              STK: <b>{account}</b> (Techcombank)
            </div>
          </div>
        )}
        <p style={{ textAlign: 'center', marginTop: 8 }}>Cảm ơn quý khách!</p>
      </div>
    </div>
  );
}
