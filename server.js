// server.js - NodeJS Print API cho nhiều máy in POS qua LAN

const express = require('express');
const cors = require('cors');
const { printer: ThermalPrinter, types: PrinterTypes } = require('node-thermal-printer');

const app = express();
app.use(cors());
app.use(express.json());

// Khai báo địa chỉ máy in
const PRINTERS = {
  bar: '192.168.1.229', // IP máy in quầy bar
  bep: '192.168.1.230'  // IP máy in bếp
};

// Hàm dựng hóa đơn, có thể tùy chỉnh thêm nếu muốn
function buildAndPrintBill({ order, menuMap = {}, itemsBill = null, discount = 0, extraFee = 0, customerName = '', note = '', showVietQR = false }, printerIp) {
  // Chuẩn bị danh sách món
  const items = itemsBill || (order.items || []).filter(item => item.status !== 'cancel');
  let subtotal = 0;
  items.forEach(item => {
    const price = menuMap[item.name]?.price ?? item.price ?? 0;
    subtotal += price * (item.quantity || 0);
  });
  const total = subtotal - discount + extraFee;

  // Khởi tạo máy in
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${printerIp}:9100`,
    characterSet: 'WPC1258', // Thường là tốt nhất cho tiếng Việt
    removeSpecialCharacters: false,
    lineCharacter: '-',
  });

  // ===== Header =====
  printer.alignCenter();
  printer.setTextDoubleHeight();
  printer.setTextDoubleWidth();
  printer.println("HÓA ĐƠN THANH TOÁN");
  printer.setTextNormal();
  printer.drawLine();

  printer.alignLeft();
  printer.println(`Bàn: ${order.tableId || ''}`);
  printer.println(`Mã đơn: ${order.orderCode || order.id}`);
  printer.println(`Thời gian: ${order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : ''}`);
  if (customerName) printer.println(`Khách: ${customerName}`);

  printer.drawLine();

  // ===== Danh sách món =====
  items.forEach(item => {
    const price = menuMap[item.name]?.price ?? item.price ?? 0;
    const lineTotal = price * item.quantity;
    // Format dòng: Tên xSố lượng [thành tiền]
    printer.println(
      `${item.name}`.padEnd(18, ' ').slice(0, 18) +
      `x${item.quantity}`.padEnd(4, ' ') +
      `${lineTotal.toLocaleString('vi-VN')}₫`.padStart(12, ' ')
    );
  });

  printer.drawLine();
  printer.alignRight();
  printer.println(`Tạm tính:   ${subtotal.toLocaleString('vi-VN')}₫`);
  if (discount) printer.println(`Giảm giá:  -${discount.toLocaleString('vi-VN')}₫`);
  if (extraFee) printer.println(`Phụ thu:   +${extraFee.toLocaleString('vi-VN')}₫`);
  printer.setTextBold();
  printer.println(`TỔNG CỘNG:  ${total.toLocaleString('vi-VN')}₫`);
  printer.setTextNormal();
  printer.alignLeft();

  if (note) {
    printer.drawLine();
    printer.println(`Ghi chú: ${note}`);
  }

  printer.drawLine();

  // ===== QR chuyển khoản (nếu cần) =====
  if (showVietQR) {
    // Thông tin VietQR, tuỳ chỉnh theo thực tế
    const bankBin = '970403';
    const account = 'TNG50523114517';
    const addInfo = encodeURIComponent(order.orderCode || order.id);
    const vietqrUrl = `https://img.vietqr.io/image/${bankBin}-${account}-print.png?amount=${total}&addInfo=${addInfo}`;
    printer.alignCenter();
    printer.println("Chuyển khoản VietQR:");
    printer.println(`Nội dung: ${decodeURIComponent(addInfo)}`);
    printer.println(`STK: ${account} (Techcombank)`);
    printer.println(vietqrUrl); // In link, nếu máy in không hỗ trợ ảnh
    printer.alignLeft();
  }

  printer.alignCenter();
  printer.println("Cảm ơn quý khách!");
  printer.println("\n\n");
  printer.cut();

  return printer.execute();
}

// Endpoint duy nhất, truyền tên máy in qua trường "printer"
app.post('/print', async (req, res) => {
  const { printer: printerTarget = 'bar', ...billData } = req.body;
  const printerIp = PRINTERS[printerTarget];
  if (!printerIp) {
    return res.status(400).json({ error: 'Chưa chọn đúng máy in!' });
  }

  try {
    await buildAndPrintBill(billData, printerIp);
    res.send({ status: 'ok' });
  } catch (err) {
    console.error("Lỗi khi in:", err);
    res.status(500).send({ error: 'Không in được', details: err.message });
  }
});

// (tuỳ chọn) Tạo endpoint riêng cho từng máy in, nếu thích kiểu RESTful
app.post('/print/bar', async (req, res) => {
  try {
    await buildAndPrintBill(req.body, PRINTERS.bar);
    res.send({ status: 'ok' });
  } catch (err) {
    res.status(500).send({ error: 'Không in được', details: err.message });
  }
});

app.post('/print/bep', async (req, res) => {
  try {
    await buildAndPrintBill(req.body, PRINTERS.bep);
    res.send({ status: 'ok' });
  } catch (err) {
    res.status(500).send({ error: 'Không in được', details: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🖨️  Print server đang chạy tại http://localhost:${PORT}`);
  console.log(`Máy in BAR: ${PRINTERS.bar}:9100`);
  console.log(`Máy in BẾP: ${PRINTERS.bep}:9100`);
});
