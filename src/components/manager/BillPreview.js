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

  // QR VietQR
  const bankBin = '970403';
  const account = 'TNG50523114517';
  const addInfo = encodeURIComponent(order.orderCode || order.id);
  const vietqrUrl = "https://images.weserv.nl/?url=" + encodeURIComponent(
    `img.vietqr.io/image/${bankBin}-${account}-print.png?amount=${total}&addInfo=${addInfo}`
  );

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
    <div style={{ padding: 0, background: '#eee', margin: 0 }}>
      <div ref={billRef} style={{
        width: 286,
        margin: '0 auto',
        background: '#fff',
        fontFamily: 'Roboto, Arial, sans-serif',
        color: '#000',
        fontSize: 11,
        padding: 0,
        border: '1px solid #eee',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        {/* HEADER */}
        <div style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 15,
          margin: 0,
          padding: 0
        }}>
          HÓA ĐƠN THANH TOÁN
        </div>
        {/* Dòng 2: Mã HD trái, Bàn phải */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          fontWeight: 600,
          margin: 0,
          padding: 0
        }}>
          <div style={{ textAlign: 'left' }}>
            Mã HD: <span>{order.orderCode || order.id}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            Bàn: <span>{order.tableId}</span>
          </div>
        </div>
        {/* Dòng 3: Thời gian trái, Khách phải */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          fontWeight: 400,
          margin: 0,
          padding: 0
        }}>
          <div style={{ textAlign: 'left' }}>
            Thời gian: <span>{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            {customerName && <>Khách: <span>{customerName}</span></>}
          </div>
        </div>
        {/* Gạch chân phân cách */}
        <div style={{
          borderBottom: '2px solid #222',
          margin: '2px 0 0 0',
          height: 0,
          width: '100%'
        }} />

        {/* DANH SÁCH MÓN */}
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          margin: 0,
          fontSize: 11,
          border: '1px solid #111'
        }}>
          <thead>
            <tr>
              <th style={{
                textAlign: 'left',
                fontWeight: 700,
                fontSize: 11,
                padding: '2px 0 2px 3px', // cách trái 3px
                border: '1px solid #111',
                background: '#f7f7f7'
              }}>Món</th>
              <th style={{
                textAlign: 'left',
                width: 30,
                fontWeight: 700,
                fontSize: 11,
                padding: '2px 0 2px 3px',
                border: '1px solid #111',
                background: '#f7f7f7'
              }}>SL</th>
              <th style={{
                textAlign: 'left',
                width: 65,
                fontWeight: 700,
                fontSize: 11,
                padding: '2px 0 2px 3px',
                border: '1px solid #111',
                background: '#f7f7f7'
              }}>Giá</th>
              <th style={{
                textAlign: 'left',
                width: 70,
                fontWeight: 700,
                fontSize: 11,
                padding: '2px 0 2px 3px',
                border: '1px solid #111',
                background: '#f7f7f7'
              }}>T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const price = menuMap[item.name]?.price ?? item.price ?? 0;
              return (
                <tr key={idx}>
                  <td style={{
                    textAlign: 'left',
                    padding: '2px 0 2px 3px',
                    wordBreak: 'break-all',
                    border: '1px solid #111'
                  }}>{item.name}</td>
                  <td style={{
                    textAlign: 'left',
                    padding: '2px 0 2px 3px',
                    border: '1px solid #111'
                  }}>{item.quantity}</td>
                  <td style={{
                    textAlign: 'left',
                    padding: '2px 0 2px 3px',
                    border: '1px solid #111'
                  }}>{price.toLocaleString('vi-VN')}</td>
                  <td style={{
                    textAlign: 'left',
                    padding: '2px 0 2px 3px',
                    border: '1px solid #111'
                  }}>{(item.quantity * price).toLocaleString('vi-VN')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* TỔNG KẾT */}
        <table style={{ width: '100%', margin: 0, fontSize: 11 }}>
          <tbody>
            <tr>
              <td colSpan={3} style={{ textAlign: 'left', fontWeight: 400 }}>Tạm tính</td>
              <td style={{ textAlign: 'right', fontWeight: 400 }}>{subtotal.toLocaleString('vi-VN')}</td>
            </tr>
            {discount > 0 &&
              <tr>
                <td colSpan={3} style={{ textAlign: 'left' }}>Giảm giá</td>
                <td style={{ textAlign: 'right', color: 'red' }}>- {discount.toLocaleString('vi-VN')}</td>
              </tr>
            }
            {extraFee > 0 &&
              <tr>
                <td colSpan={3} style={{ textAlign: 'left' }}>Phụ thu</td>
                <td style={{ textAlign: 'right', color: '#1976d2' }}>+ {extraFee.toLocaleString('vi-VN')}</td>
              </tr>
            }
            <tr>
              <td colSpan={3} style={{
                borderTop: '2px solid #222', fontWeight: 700, fontSize: 12, textAlign: 'left', paddingTop: 2
              }}>TỔNG CỘNG</td>
              <td style={{
                borderTop: '2px solid #222', fontWeight: 700, fontSize: 12, textAlign: 'right', paddingTop: 2
              }}>{total.toLocaleString('vi-VN')}</td>
            </tr>
          </tbody>
        </table>

        {/* GHI CHÚ */}
        {note &&
          <div style={{ margin: '2px 0 0 0', fontSize: 10, textAlign: 'center' }}>
            <b>Ghi chú:</b> {note}
          </div>
        }

        {/* QR THANH TOÁN */}
        {showVietQR && (
          <div style={{ textAlign: 'center', margin: '0 0 0 0' }}>
  
            <img
              ref={qrRef}
              src={vietqrUrl}
              alt="vietqr"
              style={{ width: 200, margin: '2px auto 0', border: '1px solid #eee', display: 'block' }}
              crossOrigin="anonymous"
            />
            <div style={{ fontSize: 12, margin: 0 }}>
              <span><b> Nội dung: {decodeURIComponent(addInfo)}</b></span><br />
              <span><b>STK: {account} (Sacombank)</b></span>
            </div>
          </div>
        )}

        {/* CHÂN TRANG */}
        <div style={{
          borderBottom: '2px solid #222', width: '60%', margin: '2px auto 0'
        }}></div>
        <div style={{ textAlign: 'center', fontSize: 12, margin: 0, color: '#222', lineHeight: 1.1 }}>
          --- Cảm ơn quý khách! ---
        </div>
      </div>
    </div>
  );
}
