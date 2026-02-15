const supabase = require('../config/supabaseClient');

// 1. 전체 학회원 조회 (GET)------------------------------------
exports.getAllAdmins = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('Admin_Users')
      .select('*')
      .order('name', { ascending: true }); // 이름순 정렬

    if (error) throw error;

    res.status(200).json({ success: true, data, message: "학회원 목록을 불러왔습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: "서버 오류: " + err.message });
  }
};

// 2. 학회원 추가 (POST)---------------------------------------
exports.createAdmin = async (req, res) => {
  try {
    const { name, color_hex } = req.body;

    if (!name || !color_hex) {
      return res.status(400).json({ success: false, data: null, message: "이름과 색상 코드를 모두 입력해주세요." });
    }

    const { data, error } = await supabase
      .from('Admin_Users')
      .insert([{ name, color_hex, late_count: 0 }]) // 초기 지각 횟수는 0
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data: data[0], message: "학회원이 등록되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: "서버 오류: " + err.message });
  }
};

// 3. 지각 랭킹 조회 (GET)--------------------------------------
// late_count 기준 내림차순
exports.getLateRanking = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('Admin_Users')
      .select('name, late_count, color_hex')
      .order('late_count', { ascending: false }); // 지각 많이 한 순서대로

    if (error) throw error;

    res.status(200).json({ success: true, data, message: "지각 랭킹을 불러왔습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: "서버 오류: " + err.message });
  }
};

// 4. 개인 출결 로그 (GET)---------------------------------------
exports.getAdminLogs = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 이 부분은 나중에 Shift_Attendance 테이블과 연결
    const { data, error } = await supabase
      .from('Shift_Attendance') 
      .select('*')
      .eq('admin_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ success: true, data, message: "개인 출결 로그를 불러왔습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: "서버 오류: " + err.message });
  }
};

// 5. 학회원 삭제 (DELETE)-----------------------------------
exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('Admin_Users').delete().eq('id', id);

    if (error) throw error;

    res.status(200).json({ success: true, data: null, message: "학회원 정보가 삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: "서버 오류: " + err.message });
  }
};