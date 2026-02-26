const supabase = require('../config/supabaseClient');

// 오늘 날짜 기준 주차 및 시간표 조회 (GET)-------------------------
exports.getTodaySchedule = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    //현재 날짜가 포함된 주차(week_number) 찾기
    const { data: weekData, error: weekError } = await supabase
      .from('Semester_Weeks')
      .select('week_number')
      .lte('start_date', today)
      .gte('end_date', today)
      .single();

    if (weekError || !weekData) {
      return res.status(404).json({ 
        success: false, 
        data: null, 
        message: "현재 진행 중인 학기 주차 정보를 찾을 수 없습니다." 
      });
    }

    const currentWeek = weekData.week_number;

    //해당 주차의 모든 시간표 슬롯 조회 (관리자 이름 포함 Join)
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('Weekly_Schedules')
      .select(`
        id,
        week_number,
        is_substitute,
        assigned_admin_id,
        Admin_Users (name, color_hex),
        Timetable_Slots (*)
      `)
      .eq('week_number', currentWeek);

    if (scheduleError) throw scheduleError;

    res.status(200).json({ 
      success: true, 
      data: {
        week_number: currentWeek,
        schedules: scheduleData
      }, 
      message: `${currentWeek}주차 시간표를 불러왔습니다.` 
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 2. 대타 신청/변경 (PATCH)-------------------------------------
exports.requestSubstitute = async (req, res) => {
  try {
    const { weekly_id, new_admin_id } = req.body;

    const { data, error } = await supabase
      .from('Weekly_Schedules')
      .update({ 
        assigned_admin_id: new_admin_id, 
        is_substitute: true // 대타로 변경됨을 표시
      })
      .eq('id', weekly_id)
      .select();

    if (error) throw error;

    res.status(200).json({ 
      success: true, 
      data: data[0], 
      message: "대타 변경이 완료되었습니다." 
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};


// 3. 관리 시작 (POST)--------------------------------------
exports.checkIn = async (req, res) => {
  try {
    const { weekly_id } = req.params;
    const { admin_id, is_late } = req.body; // 프론트에서 판정한 지각 여부를 받음
    const now = new Date();
    const currentTimeStr = now.toTimeString().split(' ')[0];

    // 해당 주차 슬롯의 시간 범위 가져오기
    const { data: slotInfo, error: slotError } = await supabase
      .from('Weekly_Schedules')
      .select(`
        id,
        Timetable_Slots (start_time, end_time)
      `)
      .eq('id', weekly_id)
      .single();

    if (slotError || !slotInfo) throw new Error("시간표 정보를 찾을 수 없습니다.");

    const { start_time, end_time } = slotInfo.Timetable_Slots;

    // 서버 시간 기준 범위 검증 (부정 출석 방지)
    if (currentTimeStr < start_time || currentTimeStr > end_time) {
      return res.status(403).json({
        success: false,
        data: { server_time: now.toISOString() },
        message: `현재는 관리 시간이 아닙니다. (허용 시간: ${start_time} ~ ${end_time})`
      });
    }

    // Shift_Attendance에 로그 생성 (is_late는 프론트 전달값 저장)
    const { data: attendanceData, error: authError } = await supabase
      .from('Shift_Attendance')
      .insert([{
        weekly_schedule_id: weekly_id,
        admin_id: admin_id,
        check_in_at: now.toISOString(),
        is_late: is_late // 프론트엔드에서 판단해서 보내준 값
      }])
      .select()
      .single();

    if (authError) throw authError;

    res.status(201).json({
      success: true,
      data: {
        attendance_id: attendanceData.id,
        server_time: now.toISOString()
      },
      message: "출석 로그가 기록되었습니다."
    });

  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 2. 관리 종료 (PATCH)-------------------------------------
exports.checkOut = async (req, res) => {
  try {
    const { attendance_id } = req.params;
    const now = new Date();

    const { error } = await supabase
      .from('Shift_Attendance')
      .update({ check_out_at: now.toISOString() })
      .eq('id', attendance_id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: { check_out_time: now.toISOString() },
      message: "퇴근 로그가 기록되었습니다."
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};