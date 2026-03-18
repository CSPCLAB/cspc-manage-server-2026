const supabase = require('../config/supabaseClient');

// 1. 학기 시간표 리셋 (POST)----------------------------------
// 1. 학기 데이터 및 지각 횟수 전체 리셋
exports.resetSemester = async (req, res) => {
  try {
    // 0) [필수 추가] 출석 기록 먼저 삭제 (참조 무결성 에러 방지)
    // Weekly_Schedules를 참조하고 있는 자식 데이터를 가장 먼저 지워야 합니다.
    const { error: attendanceError } = await supabase
      .from('Shift_Attendance')
      .delete()
      .neq('id', 0);

    if (attendanceError) throw attendanceError;

    // 1) 생성된 1~16주차 시간표 데이터 전체 삭제
    const { error: scheduleError } = await supabase
      .from('Weekly_Schedules')
      .delete()
      .neq('id', 0);

    if (scheduleError) throw scheduleError;

    // 2) 학기 주차 정보(날짜 등) 전체 삭제
    const { error: weekError } = await supabase
      .from('Semester_Weeks')
      .delete()
      .neq('id', 0);

    if (weekError) throw weekError;

    // 3) Timetable_Slots의 기본 담당자 정보 초기화
    const { error: templateError } = await supabase
      .from('Timetable_Slots')
      .update({ default_admin_id: null })
      .neq('id', 0);

    if (templateError) throw templateError;

    // 4) 모든 학회원의 지각 횟수 0으로 초기화
    const { error: userError } = await supabase
      .from('Admin_Users')
      .update({ late_count: 0 })
      .neq('id', 0);

    if (userError) throw userError;

    res.status(200).json({ 
      success: true, 
      message: "출석 기록을 포함한 모든 데이터가 초기화되었습니다." 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "리셋 실패: " + err.message });
  }
};

// 2. 개강일 종강일 입력 (POST)----------------------------------
// 입력받은 개강주차부터 종강주차까지 start_date, end_date를 생성
exports.setupAcademicCalendar = async (req, res) => {
  try {
    const { startDate, endDate } = req.body; 
    let start = new Date(startDate);
    let end = new Date(endDate);

    let firstMonday = new Date(start);
    let day = start.getDay();
    let diff = (day === 0 ? -6 : 1 - day); 
    firstMonday.setDate(start.getDate() + diff); 

    let weeks = [];
    let currentMonday = new Date(firstMonday);
    let weekNum = 1;

    while (currentMonday <= end) {
      let currentSunday = new Date(currentMonday);
      currentSunday.setDate(currentMonday.getDate() + 6);
      weeks.push({
        week_number: weekNum++,
        start_date: currentMonday.toISOString().split('T')[0],
        end_date: currentSunday.toISOString().split('T')[0]
      });
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    // 1) Semester_Weeks 저장
    const { data: weekData, error: weekError } = await supabase
      .from('Semester_Weeks')
      .insert(weeks)
      .select();
    if (weekError) throw weekError;

    // 2) Timetable_Slots에서 기본 틀(원본) 가져오기
    const { data: slotData, error: slotError } = await supabase
      .from('Timetable_Slots')
      .select('id, default_admin_id');
    if (slotError) throw slotError;

    // 3) 모든 주차에 대해 슬롯 복사 데이터 생성
    const fullSchedules = [];
    weekData.forEach(week => {
      slotData.forEach(slot => {
        fullSchedules.push({
          week_number: week.week_number,
          slot_id: slot.id,
          assigned_admin_id: slot.default_admin_id, // 기본 담당자 복사
          is_substitute: false
        });
      });
    });

    // 4) Weekly_Schedules 대량 저장
    const { error: scheduleError } = await supabase
      .from('Weekly_Schedules')
      .insert(fullSchedules);
    if (scheduleError) throw scheduleError;

    res.status(201).json({ 
      success: true, 
      message: `${weeks.length}주차 분량의 날짜 및 시간표 데이터 생성이 완료되었습니다.` 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. 기본 시간표 담당자 일괄 수정 (PATCH)----------------------
exports.updateDefaultScheduleManager = async (req, res) => {
  try {
    const { schedules } = req.body; 

    if (!Array.isArray(schedules)) {
      throw new Error("배열 형식이 필요합니다.");
    }

    // 모든 슬롯을 각각 업데이트하는 Promise 배열 생성 
    const updatePromises = schedules.map(item => 
      supabase
        .from('Timetable_Slots')
        .update({ default_admin_id: item.default_admin_id }) // 담당자만 수정 
        .eq('id', item.id) // 해당 ID의 행만 타겟팅 
    );

    // 병렬로 모든 업데이트 실행 
    const results = await Promise.all(updatePromises);

    // 실행 결과 중 에러가 있는지 체크
    const errorResult = results.find(r => r.error);
    if (errorResult) throw errorResult.error;

    res.status(200).json({ 
      success: true, 
      message: "기본 관리자 설정이 모두 업데이트되었습니다." 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "일괄 저장 실패: " + err.message });
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