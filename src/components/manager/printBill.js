// printBill.js - In hóa đơn đơn hàng (khổ giấy 80mm chuẩn POS)

export const printBill = (order, menuMap) => {
    const rows = order.items
      .filter(item => item.status !== 'cancel')
      .map(item => {
        const price = menuMap[item.name]?.price || 0;
        return `
          <tr>
            <td>${item.name}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">${price.toLocaleString('vi-VN')}₫</td>
            <td style="text-align:right">${(price * item.quantity).toLocaleString('vi-VN')}₫</td>
          </tr>
        `;
      }).join('');
  
    const total = (order.items || []).reduce((sum, item) => {
      if (item.status === 'cancel') return sum;
      const price = menuMap[item.name]?.price || 0;
      return sum + price * (item.quantity || 0);
    }, 0).toLocaleString('vi-VN');
  
    const popup = window.open('', '_blank', 'width=600,height=800');
    if (!popup) return;
  
    popup.document.write(`
      <html>
        <head>
          <title>Hóa đơn ${order.orderCode || order.id}</title>
          <style>
            @media print {
              @page { size: 80mm auto; margin: 0; }
              body { width: 72mm; margin: 0 auto; font-size: 12px; }
            }
            body { font-family: Arial, sans-serif; padding: 10px; font-size: 12px; }
            h2 { text-align: center; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border-bottom: 1px dashed #ccc; padding: 4px; font-size: 12px; }
            th { text-align: left; }
            tfoot td { font-weight: bold; border-top: 1px solid #000; }
            p { margin: 4px 0; }
          </style>
        </head>
        <body>
          <h2>HÓA ĐƠN THANH TOÁN</h2>
          <p><strong>Bàn:</strong> ${order.tableId}</p>
          <p><strong>Mã đơn:</strong> ${order.orderCode || order.id}</p>
          <p><strong>Thời gian:</strong> ${new Date(order.createdAt).toLocaleString('vi-VN')}</p>
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
                <td colspan="3">Tổng cộng</td>
                <td style="text-align:right">${total}₫</td>
              </tr>
            </tfoot>
          </table>
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
  