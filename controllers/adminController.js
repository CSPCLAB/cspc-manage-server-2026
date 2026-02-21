const supabase = require('../config/supabaseClient');

// 1. 학기 시간표 리셋 (POST)----------------------------------
// Admin_Users 테이블의 모든 late_count를 0으로 초기화
exports.resetSemester = async (req, res) => {
  try {
    const { error } = await supabase
      .from('Admin_Users')
      .update({ late_count: 0 }) // 모든 사용자의 지각 횟수 리셋
      .neq('id', 0); // id가 0이 아닌 모든 행

    if (error) throw error;

    res.status(200).json({ success: true, data: data, message: "학기가 리셋. 모든 지각 횟수가 0이 되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: "리셋 실패: " + err.message });
  }
};

// 2. 개강일 종강일 입력 (POST)----------------------------------
// 입력받은 개강주차부터 종강주차까지 start_date, end_date를 생성
exports.setupAcademicCalendar = async (req, res) => {
  try {
    const { startDate, endDate } = req.body; // 개강일, 종강일 입력
    
    let start = new Date(startDate);
    let end = new Date(endDate);

    // 입력된 개강일의 해당 주 일요일 찾기 (일: 0, 월: 1 ...)
    let firstSunday = new Date(start);
    firstSunday.setDate(start.getDate() - start.getDay()); 

    let weeks = [];
    let currentSunday = new Date(firstSunday);
    let weekNum = 1;

    // 종강일이 포함된 주의 토요일까지 반복
    while (currentSunday <= end) {
      let currentSaturday = new Date(currentSunday);
      currentSaturday.setDate(currentSunday.getDate() + 6);

      weeks.push({
        week_number: weekNum++,
        start_date: currentSunday.toISOString().split('T')[0],
        end_date: currentSaturday.toISOString().split('T')[0]
      });

      // 다음 주 일요일로 이동
      currentSunday.setDate(currentSunday.getDate() + 7);
    }

    const { error } = await supabase.from('Semester_Weeks').insert(weeks);
    if (error) throw error;

    res.status(201).json({ success: true, data: data[0], message: "일-토 기준 주차 생성이 완료되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 3. 주차별 시간표 수정 (PATCH)--------------------------------
// 특정 주차의 특정 슬롯 담당자를 변경
exports.updateWeeklySchedule = async (req, res) => {
  try {
    const { weekly_id } = req.params; // 수정할 Weekly_Schedules의 ID
    const { assigned_admin_id, is_substitute } = req.body;

    const { data, error } = await supabase
      .from('Weekly_Schedules')
      .update({ assigned_admin_id, is_substitute })
      .eq('id', weekly_id)
      .select();

    if (error) throw error;

    res.status(200).json({ success: true, data: data[0], message: "시간표가 수정되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: "수정 실패: " + err.message });
  }
};

// 4. 학회원 추가 (POST)---------------------------------------
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