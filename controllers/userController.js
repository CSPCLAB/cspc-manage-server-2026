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

// 1-2. 특정 학회원 정보 조회 (GET)--------------------------------
exports.getAdminDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('Admin_Users')
      .select('id, name, color_hex, late_count')
      .eq('id', id)
      .single();

    if (error) {
      // 존재하지 않는 사용자의 경우 에러 처리
      return res.status(404).json({ 
        success: false, 
        data: null, 
        message: "해당 학회원을 찾을 수 없습니다." 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: data, 
      message: `${data.name}님의 정보를 불러왔습니다.` 
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 1-3. 특정 학회원 정보 수정 (PATCH)-----------------------------
exports.updateAdminInfo = async (req, res) => {
  try {
    const { id } = req.params;
    // 프론트엔드에서 보낸 수정 데이터 (이름, 색상, 지각 횟수 등)
    const { name, color_hex, late_count } = req.body;

    const { data, error } = await supabase
      .from('Admin_Users')
      .update({ 
        name, 
        color_hex, 
        late_count 
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        message: "해당 학회원을 찾을 수 없습니다."
      });
    }

    res.status(200).json({ 
      success: true, 
      data: data[0], 
      message: "학회원 정보가 성공적으로 수정되었습니다." 
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 2. 지각 랭킹 조회 (GET)--------------------------------------
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

// 3. 개인 출결 로그 (GET)---------------------------------------
exports.getAdminLogs = async (req, res) => {
  try {
    const { id } = req.params;

    // 해당 학회원의 출결 기록을 최신순으로 가져옴
    const { data, error } = await supabase
      .from('Shift_Attendance')
      .select(`
        id,
        check_in_at,
        check_out_at,
        status,
        Weekly_Schedules (
          week_number,
          Timetable_Slots (day_of_week, period_number)
        )
      `) // 어떤 주차, 무슨 요일 수업이었는지 정보도 함께 
      .eq('admin_id', id)
      .order('check_in_at', { ascending: false }); // 최신 기록이 위로 오게 정렬

    if (error) throw error;

    res.status(200).json({ 
      success: true, 
      data, 
      message: "개인 출결 로그를 성공적으로 불러왔습니다." 
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

