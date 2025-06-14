// server.js - Nhẹ tối đa, không dùng characterSet
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { printer: ThermalPrinter, types: PrinterTypes } = require('node-thermal-printer');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// IP máy in
const PRINTERS = {
  bar: '192.168.1.229', // Máy in quầy bar
  bep: '192.168.1.229'  // Máy in bếp
};



// In ảnh PNG
app.post('/print/image', upload.single('file'), async (req, res) => {
  console.log('Uploaded file:', req.file);
  const { printer: printerTarget = 'bar' } = req.body;
  const printerIp = PRINTERS[printerTarget];

  if (!printerIp || !req.file) {
    return res.status(400).json({ error: 'Thiếu file ảnh hoặc máy in không hợp lệ.' });
  }

  // Đổi tên file tạm thành file có đuôi .png
  const oldPath = req.file.path;
  const newPath = oldPath + '.png';
  fs.renameSync(oldPath, newPath); // đồng bộ, vì file nhỏ

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${printerIp}:9100`,
    removeSpecialCharacters: false
  });

  try {
    await printer.printImage(newPath);
    printer.cut();
    await printer.execute();
    fs.unlinkSync(newPath);
    res.send({ status: 'ok' });
  } catch (err) {
    console.error('❌ In lỗi:', err);
    res.status(500).json({ error: 'Không in được ảnh', detail: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🖨️ Print server đang chạy tại http://192.168.1.200:${PORT}`);
}); 
