exports.restrictToLabIP = (req, res, next) => {
  const allowedIPs = ['163.239.81.249']; // 랩실 공인 IP 주소
  const userIP = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  if (allowedIPs.includes(userIP)) {
    next();
  } else {
    res.status(403).json({ success: false, message: "랩실 네트워크에서만 가능합니다." });
  }
};