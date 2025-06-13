import React, { useEffect, useState } from "react";
import {
  Box, Typography, TextField, Stack, Paper, Select, MenuItem, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableRow, TableCell, TableBody, Snackbar, Alert, Card, CardContent, CardActions
} from "@mui/material";
import { db, auth } from "../../firebaseConfig";
import { collection, getDocs, setDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

const ROLES = [
  { value: "staff", label: "Nhân viên phục vụ" },
  { value: "kitchen", label: "Bếp" },
  { value: "manager", label: "Quản lý" },
];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ staffCode: "", password: "", role: "staff" });
  const [status, setStatus] = useState({ loading: false, error: "", success: "" });
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [resetDialog, setResetDialog] = useState({ open: false, staffCode: "" });
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, "users", auth.currentUser.uid)).then((docSnap) => {
        if (docSnap.exists()) setCurrentUserRole(docSnap.data().role || "");
      });
    }
  }, []);

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const arr = [];
    snap.forEach((doc) => {
      arr.push({ id: doc.id, ...doc.data() });
    });
    setUsers(arr);
  };
  useEffect(() => { if (currentUserRole === "manager") fetchUsers(); }, [currentUserRole]);

  // Tạo user bằng staffCode (mã nhân viên), email = staffCode@1.com
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: "", success: "" });
    try {
      const staffCode = newUser.staffCode.trim().toLowerCase();
      if (!staffCode.match(/^[a-z0-9_]+$/)) throw new Error("Mã nhân viên chỉ được dùng chữ, số, _ và không có dấu cách!");
      const fakeEmail = `${staffCode}@1.com`;
      // Check trùng staffCode
      if (users.find(u => u.staffCode === staffCode)) throw new Error("Mã nhân viên đã tồn tại!");

      const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, newUser.password);
      const uid = userCredential.user.uid;
      await setDoc(doc(db, "users", uid), {
        staffCode,
        email: fakeEmail,
        role: newUser.role,
        active: true,
        createdAt: Date.now(),
      });
      setStatus({ loading: false, error: "", success: "Đã tạo tài khoản thành công!" });
      setNewUser({ staffCode: "", password: "", role: "staff" });
      fetchUsers();
      setSnack({ open: true, msg: "Đã tạo tài khoản thành công!", severity: "success" });
    } catch (err) {
      setStatus({ loading: false, error: err.message, success: "" });
      setSnack({ open: true, msg: err.message, severity: "error" });
    }
  };

  const handleToggleActive = async (user) => {
    await updateDoc(doc(db, "users", user.id), { active: !user.active });
    fetchUsers();
    setSnack({ open: true, msg: user.active ? "Đã vô hiệu hóa tài khoản." : "Đã kích hoạt lại tài khoản.", severity: "info" });
  };

  const handleSendReset = async (staffCode) => {
    try {
      const fakeEmail = `${staffCode}@1.com`;
      await sendPasswordResetEmail(auth, fakeEmail);
      setResetDialog({ open: false, staffCode: "" });
      setSnack({ open: true, msg: "Đã gửi email đặt lại mật khẩu!", severity: "success" });
    } catch (err) {
      setSnack({ open: true, msg: err.message, severity: "error" });
    }
  };

  if (currentUserRole !== "manager")
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error" variant="h6">Bạn không có quyền truy cập trang này.</Typography>
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 1, sm: 3 }, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        👥 Quản lý tài khoản nhân viên/bếp
      </Typography>
      {/* Form tạo tài khoản */}
      <Box sx={{ p: 2, mb: 3, background: "#f7f7f7", borderRadius: 2 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          ➕ Tạo tài khoản mới
        </Typography>
        <form onSubmit={handleCreateUser}>
          <Stack direction="column" spacing={2}>
            <TextField
              required
              label="Mã nhân viên"
              value={newUser.staffCode}
              onChange={e => setNewUser(u => ({ ...u, staffCode: e.target.value.trim() }))}
              size="small"
              fullWidth
              inputProps={{ pattern: "[a-z0-9_]+" }}
              helperText="Chỉ dùng chữ thường, số, dấu _ (vd: nv01, phucvu_2...)"
            />
            <TextField
              required
              label="Mật khẩu"
              type="password"
              value={newUser.password}
              onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
              size="small"
              fullWidth
            />
            <Select
              value={newUser.role}
              onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
              size="small"
              fullWidth
            >
              {ROLES.map(r => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </Select>
            <Button type="submit" variant="contained" disabled={status.loading} fullWidth size="large">
              Tạo tài khoản
            </Button>
          </Stack>
        </form>
      </Box>

      {/* Danh sách user */}
      {isMobile ? (
        <Stack spacing={2}>
          {users.map((user) => (
            <Card key={user.id} variant="outlined" sx={{ borderRadius: 2, boxShadow: 1 }}>
              <CardContent>
                <Typography fontWeight="bold" fontSize={17}>
                  {user.staffCode}
                  <span style={{ color: "#888", fontSize: 13, marginLeft: 10 }}>({user.email})</span>
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={1} mb={1}>
                  <Chip
                    label={ROLES.find((r) => r.value === user.role)?.label || user.role}
                    color={user.role === "manager" ? "info" : user.role === "kitchen" ? "warning" : "default"}
                    size="small"
                  />
                  <Chip
                    label={user.active ? "Đang hoạt động" : "Vô hiệu hóa"}
                    color={user.active ? "success" : "error"}
                    size="small"
                    sx={{ cursor: "pointer" }}
                    onClick={() => handleToggleActive(user)}
                    title="Bấm để đổi trạng thái"
                  />
                </Stack>
                <Typography fontSize={13} color="text.secondary" mb={1}>
                  {user.createdAt
                    ? `Tạo lúc: ${new Date(user.createdAt).toLocaleString("vi-VN")}`
                    : ""}
                </Typography>
                <CardActions sx={{ p: 0 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => setResetDialog({ open: true, staffCode: user.staffCode })}
                  >
                    Đặt lại mật khẩu
                  </Button>
                </CardActions>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Paper sx={{ p: 2, overflowX: "auto" }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Danh sách tài khoản
          </Typography>
          <Table size="small" sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Mã NV</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Vai trò</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Ngày tạo</TableCell>
                <TableCell>Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell sx={{ fontSize: 15 }}>{user.staffCode}</TableCell>
                  <TableCell sx={{ fontSize: 13, color: "#888" }}>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={ROLES.find((r) => r.value === user.role)?.label || user.role}
                      color={user.role === "manager" ? "info" : user.role === "kitchen" ? "warning" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.active ? "Đang hoạt động" : "Vô hiệu hóa"}
                      color={user.active ? "success" : "error"}
                      size="small"
                      sx={{ cursor: "pointer" }}
                      onClick={() => handleToggleActive(user)}
                      title="Bấm để đổi trạng thái"
                    />
                  </TableCell>
                  <TableCell>
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleString("vi-VN")
                      : ""}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setResetDialog({ open: true, staffCode: user.staffCode })}
                      >
                        Đặt lại mật khẩu
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Dialog đặt lại mật khẩu */}
      <Dialog open={resetDialog.open} onClose={() => setResetDialog({ open: false, staffCode: "" })}>
        <DialogTitle>Đặt lại mật khẩu</DialogTitle>
        <DialogContent>
          <Typography>
            Gửi email đặt lại mật khẩu cho tài khoản: <b>{resetDialog.staffCode}@1.com</b>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialog({ open: false, staffCode: "" })}>Hủy</Button>
          <Button variant="contained" onClick={() => handleSendReset(resetDialog.staffCode)}>
            Gửi email
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snack.severity} sx={{ width: "100%" }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;
