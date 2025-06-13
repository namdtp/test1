// printBill.js - Chuẩn Unicode, font đẹp, tích hợp QR Techcombank

export const printBill = (
  order,
  menuMap,
  {
    itemsBill = null,
    discount = 0,
    extraFee = 0,
    customerName = '',
    note = '',
    showVietQR = true // Luôn hiển thị QR
  } = {}
) => {
  const items = itemsBill || (order.items || []).filter(item => item.status !== 'cancel');

  const rows = items.map(item => {
    const price = menuMap[item.name]?.price ?? item.price ?? 0;
    return `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${price.toLocaleString('vi-VN')}₫</td>
        <td style="text-align:right">${(price * item.quantity).toLocaleString('vi-VN')}₫</td>
      </tr>
    `;
  }).join('');

  const subtotal = items.reduce((sum, item) => {
    const price = menuMap[item.name]?.price ?? item.price ?? 0;
    return sum + price * (item.quantity || 0);
  }, 0);

  const total = subtotal - discount + extraFee;

  // Techcombank: bankBin = '970418', account = '0942074779'
  const bankBin = '970403';
  const account = 'TNG50523114517';
  const addInfo = encodeURIComponent(order.orderCode || order.id);
  const vietqrUrl = `https://img.vietqr.io/image/${bankBin}-${account}-print.png?amount=${total}&addInfo=${addInfo}`;

  const popup = window.open('', '_blank', 'width=600,height=800');
  if (!popup) return;

  popup.document.write(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Hóa đơn ${order.orderCode || order.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: 80mm auto; margin: 0; }
            body { width: 72mm; margin: 0 auto; font-size: 12px; }
          }
          body { 
            font-family: 'Roboto', Arial, "Segoe UI", "Noto Sans", sans-serif; 
            font-size: 12px; 
            padding: 10px;
          }
          h2 { text-align: center; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border-bottom: 1px dashed #ccc; padding: 4px; font-size: 12px; }
          th { text-align: left; }
          tfoot td { font-weight: bold; border-top: 1px solid #000; }
          p { margin: 4px 0; }
          .total-line { font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>HÓA ĐƠN THANH TOÁN</h2>
        <p><strong>Bàn:</strong> ${order.tableId}</p>
        <p><strong>Mã đơn:</strong> ${order.orderCode || order.id}</p>
        <p><strong>Thời gian:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : ''}</p>
        ${customerName ? `<p><strong>Khách:</strong> ${customerName}</p>` : ''}
        <table>
          <thead>
            <tr>
              <th>Món</th>
              <th style="text-align:center">SL</th>
              <th style="text-align:right">Đơn giá</th>
              <th style="text-align:right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Tạm tính</td>
              <td style="text-align:right">${subtotal.toLocaleString('vi-VN')}₫</td>
            </tr>
            ${discount ? `
            <tr>
              <td colspan="3">Giảm giá</td>
              <td style="text-align:right">- ${discount.toLocaleString('vi-VN')}₫</td>
            </tr>` : ''}
            ${extraFee ? `
            <tr>
              <td colspan="3">Phụ thu</td>
              <td style="text-align:right">+ ${extraFee.toLocaleString('vi-VN')}₫</td>
            </tr>` : ''}
            <tr class="total-line">
              <td colspan="3">TỔNG CỘNG</td>
              <td style="text-align:right">${total.toLocaleString('vi-VN')}₫</td>
            </tr>
          </tfoot>
        </table>
        ${note ? `<p><strong>Ghi chú:</strong> ${note}</p>` : ''}
        ${
          showVietQR
            ? `<div style="text-align:center;margin:12px 0;">
                <b>Chuyển khoản VietQR:</b><br/>
                <img src="${vietqrUrl}" style="width:250px;display:block;margin:8px auto 0 auto;"/>
                <div style="font-size:11px;">Nội dung chuyển khoản: <b>${decodeURIComponent(addInfo)}</b></div>
                <div style="font-size:11px;">STK: <b>${account}</b> (Techcombank)</div>
              </div>`
            : ''
        }
        <p style="text-align:center; margin-top: 16px;">Cảm ơn quý khách!</p>
        <script>
          window.print();
          window.onafterprint = () => window.close();
        </script>
      </body>
    </html>
  `);
  popup.document.close();
};
