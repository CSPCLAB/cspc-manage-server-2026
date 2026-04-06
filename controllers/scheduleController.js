const supabase = require('../config/supabaseClient');

const DAY_TO_OFFSET = {
  월: 0,
  화: 1,
  수: 2,
  목: 3,
  금: 4,
  토: 5,
  일: 6,
};

function getKSTNow() {
  return new Date();
}

function getKSTParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function formatKSTTimestamp(date) {
  const { year, month, day, hour, minute, second } = getKSTParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

function parseKSTDateTime(dateText, timeText) {
  if (!dateText || !timeText) return null;
  return new Date(`${dateText}T${String(timeText).slice(0, 8)}+09:00`);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDateOnly(date) {
  const { year, month, day } = getKSTParts(date);
  return `${year}-${month}-${day}`;
}

function getDayOffset(dayOfWeek) {
  const key = String(dayOfWeek || '').trim().charAt(0);
  return DAY_TO_OFFSET[key] ?? null;
}

function buildClassWindow(weekStartDate, dayOfWeek, startTime, endTime) {
  const offset = getDayOffset(dayOfWeek);
  if (offset == null || !weekStartDate || !startTime || !endTime) return null;

  const monday = parseKSTDateTime(weekStartDate, '00:00:00');
  if (!monday) return null;

  const classDate = addDays(monday, offset);
  const classDateText = formatDateOnly(classDate);
  const startAt = parseKSTDateTime(classDateText, startTime);
  let endAt = parseKSTDateTime(classDateText, endTime);

  if (!startAt) return null;
  if (!endAt || endAt <= startAt) {
    endAt = addMinutes(startAt, 75);
  }

  return { startAt, endAt };
}

async function getWeekMeta(weekNumber) {
  const { data, error } = await supabase
    .from('Semester_Weeks')
    .select('week_number, start_date, end_date')
    .eq('week_number', weekNumber)
    .single();

  if (error || !data?.start_date || !data?.end_date) {
    throw new Error('주차 날짜 정보를 찾을 수 없습니다.');
  }

  return data;
}

async function getWeekStartDate(weekNumber) {
  const weekMeta = await getWeekMeta(weekNumber);
  return weekMeta.start_date;
}

async function getWeeklyScheduleWithAttendance(weeklyId) {
  const { data, error } = await supabase
    .from('Weekly_Schedules')
    .select(`
      id,
      week_number,
      assigned_admin_id,
      Timetable_Slots (id, day_of_week, period_number, start_time, end_time)
    `)
    .eq('id', weeklyId)
    .single();

  if (error || !data) {
    throw new Error('시간표 정보를 찾을 수 없습니다.');
  }

  return data;
}

async function getAttendanceRowByWeeklyId(weeklyId) {
  const { data, error } = await supabase
    .from('Shift_Attendance')
    .select('id, weekly_schedule_id, admin_id, check_in_at, check_out_at, is_late')
    .eq('weekly_schedule_id', weeklyId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function getAttendanceRowsByWeeklyIds(weeklyIds) {
  if (!Array.isArray(weeklyIds) || weeklyIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('Shift_Attendance')
    .select('id, weekly_schedule_id, admin_id, check_in_at, check_out_at, is_late')
    .in('weekly_schedule_id', weeklyIds)
    .order('id', { ascending: true });

  if (error) throw error;

  const attendanceMap = new Map();
  for (const row of data ?? []) {
    if (!attendanceMap.has(row.weekly_schedule_id)) {
      attendanceMap.set(row.weekly_schedule_id, row);
    }
  }

  return attendanceMap;
}

async function ensureAttendanceRow(schedule) {
  const existing = await getAttendanceRowByWeeklyId(schedule.id);
  if (existing) return existing;

  if (!schedule?.assigned_admin_id) {
    throw new Error('현재 담당자가 배정되지 않아 출석 행을 만들 수 없습니다.');
  }

  const { data, error } = await supabase
    .from('Shift_Attendance')
    .insert([
      {
        weekly_schedule_id: schedule.id,
        admin_id: schedule.assigned_admin_id,
        check_in_at: null,
        check_out_at: null,
        is_late: false,
      },
    ])
    .select('id, admin_id, check_in_at, check_out_at, is_late')
    .single();

  if (!error && data) {
    return data;
  }

  const fallback = await getAttendanceRowByWeeklyId(schedule.id);
  if (fallback) return fallback;

  throw new Error('출석 행을 생성하지 못했습니다.');
}

async function applyLatePenaltyIfNeeded(attendanceRow) {
  if (!attendanceRow || attendanceRow.is_late || !attendanceRow.admin_id) {
    return attendanceRow;
  }

  const { data: updatedAttendance, error: attendanceError } = await supabase
    .from('Shift_Attendance')
    .update({ is_late: true })
    .eq('id', attendanceRow.id)
    .eq('is_late', false)
    .select('id, admin_id, check_in_at, check_out_at, is_late')
    .single();

  if (attendanceError) {
    throw attendanceError;
  }

  if (!updatedAttendance) {
    return { ...attendanceRow, is_late: true };
  }

  const { data: adminUser, error: adminError } = await supabase
    .from('Admin_Users')
    .select('late_count')
    .eq('id', updatedAttendance.admin_id)
    .single();

  if (adminError || !adminUser) {
    throw adminError || new Error('지각 카운트를 갱신할 학회원을 찾을 수 없습니다.');
  }

  const { error: updateUserError } = await supabase
    .from('Admin_Users')
    .update({ late_count: (adminUser.late_count ?? 0) + 1 })
    .eq('id', updatedAttendance.admin_id);

  if (updateUserError) throw updateUserError;

  return updatedAttendance;
}

// 1. 오늘 날짜 기준 주차 및 시간표 조회 (GET)-------------------------
exports.getWeeklySchedule = async (req, res) => {
  try {
    const { week } = req.params;
    let currentWeek;
    let weekMeta;

    if (week === 'today') {
      const now = getKSTNow();
      const today = formatDateOnly(now);

      const { data: weekData, error: weekError } = await supabase
        .from('Semester_Weeks')
        .select('week_number, start_date, end_date')
        .lte('start_date', today)
        .gte('end_date', today)
        .single();

      if (weekError || !weekData) throw new Error('현재 주차 정보를 찾을 수 없습니다.');
      currentWeek = weekData.week_number;
      weekMeta = weekData;
    } else {
      currentWeek = parseInt(week, 10);
      weekMeta = await getWeekMeta(currentWeek);
    }

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
      .eq('week_number', currentWeek)
      .order('id', { ascending: true });

    if (scheduleError) throw scheduleError;

    const weeklyIds = (scheduleData ?? []).map((schedule) => schedule.id);
    const attendanceMap = await getAttendanceRowsByWeeklyIds(weeklyIds);
    const schedulesWithAttendance = (scheduleData ?? []).map((schedule) => ({
      ...schedule,
      Shift_Attendance: attendanceMap.has(schedule.id) ? [attendanceMap.get(schedule.id)] : [],
    }));

    res.status(200).json({
      success: true,
      data: {
        week_number: currentWeek,
        start_date: weekMeta.start_date,
        end_date: weekMeta.end_date,
        schedules: schedulesWithAttendance,
      },
      message: `${currentWeek}주차 시간표를 불러왔습니다.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. 대타 신청/변경 (PATCH)-------------------------------------
exports.requestSubstitute = async (req, res) => {
  try {
    const { weekly_id, new_admin_id, is_substitute } = req.body;

    const { data, error } = await supabase
      .from('Weekly_Schedules')
      .update({
        assigned_admin_id: new_admin_id,
        is_substitute: is_substitute,
      })
      .eq('id', weekly_id)
      .select();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: data[0],
      message: '대타 변경이 완료되었습니다.',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 3. 관리 시작 (POST)--------------------------------------
exports.checkIn = async (req, res) => {
  try {
    const { weekly_id } = req.params;
    const now = getKSTNow();
    const nowKST = formatKSTTimestamp(now);

    const schedule = await getWeeklyScheduleWithAttendance(weekly_id);

    if (!schedule.assigned_admin_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '현재 담당자가 배정되지 않아 관리 시작을 기록할 수 없습니다.',
      });
    }

    let attendanceRow = await ensureAttendanceRow(schedule);

    if (attendanceRow.check_in_at) {
      return res.status(200).json({
        success: true,
        data: {
          attendance_id: attendanceRow.id,
          check_in_at: attendanceRow.check_in_at,
          check_out_at: attendanceRow.check_out_at,
          is_late: attendanceRow.is_late,
          server_time: nowKST,
        },
        message: '이미 관리 시작이 기록되어 있습니다.',
      });
    }

    const weekStartDate = await getWeekStartDate(schedule.week_number);
    const windowInfo = buildClassWindow(
      weekStartDate,
      schedule.Timetable_Slots?.day_of_week,
      schedule.Timetable_Slots?.start_time,
      schedule.Timetable_Slots?.end_time
    );

    if (!windowInfo) {
      throw new Error('수업 시간 정보를 계산할 수 없습니다.');
    }

    const startLateAt = addMinutes(windowInfo.startAt, 10);

    if (now > startLateAt) {
      attendanceRow = await applyLatePenaltyIfNeeded(attendanceRow);
    }

    const { data: updatedAttendance, error: updateError } = await supabase
      .from('Shift_Attendance')
      .update({
        admin_id: schedule.assigned_admin_id,
        check_in_at: nowKST,
      })
      .eq('id', attendanceRow.id)
      .select('id, admin_id, check_in_at, check_out_at, is_late')
      .single();

    if (updateError || !updatedAttendance) {
      throw updateError || new Error('관리 시작을 기록하지 못했습니다.');
    }

    res.status(200).json({
      success: true,
      data: {
        attendance_id: updatedAttendance.id,
        check_in_at: updatedAttendance.check_in_at,
        check_out_at: updatedAttendance.check_out_at,
        is_late: updatedAttendance.is_late,
        server_time: nowKST,
      },
      message: '관리 시작이 기록되었습니다.',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 4. 관리 종료 (PATCH)-------------------------------------
exports.checkOut = async (req, res) => {
  try {
    const { weekly_id } = req.params;
    const now = getKSTNow();
    const nowKST = formatKSTTimestamp(now);

    const schedule = await getWeeklyScheduleWithAttendance(weekly_id);
    let attendanceRow = await ensureAttendanceRow(schedule);

    if (!attendanceRow.check_in_at) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '관리 시작 기록이 없어 종료할 수 없습니다.',
      });
    }

    if (attendanceRow.check_out_at) {
      return res.status(200).json({
        success: true,
        data: {
          attendance_id: attendanceRow.id,
          check_in_at: attendanceRow.check_in_at,
          check_out_at: attendanceRow.check_out_at,
          is_late: attendanceRow.is_late,
          server_time: nowKST,
        },
        message: '이미 관리 종료가 기록되어 있습니다.',
      });
    }

    const weekStartDate = await getWeekStartDate(schedule.week_number);
    const windowInfo = buildClassWindow(
      weekStartDate,
      schedule.Timetable_Slots?.day_of_week,
      schedule.Timetable_Slots?.start_time,
      schedule.Timetable_Slots?.end_time
    );

    if (!windowInfo) {
      throw new Error('수업 시간 정보를 계산할 수 없습니다.');
    }

    const endLateAt = addMinutes(windowInfo.endAt, 10);

    if (now > endLateAt) {
      attendanceRow = await applyLatePenaltyIfNeeded(attendanceRow);
    }

    const { data: updatedAttendance, error: updateError } = await supabase
      .from('Shift_Attendance')
      .update({ check_out_at: nowKST })
      .eq('id', attendanceRow.id)
      .select('id, admin_id, check_in_at, check_out_at, is_late')
      .single();

    if (updateError || !updatedAttendance) {
      throw updateError || new Error('관리 종료를 기록하지 못했습니다.');
    }

    res.status(200).json({
      success: true,
      data: {
        attendance_id: updatedAttendance.id,
        check_in_at: updatedAttendance.check_in_at,
        check_out_at: updatedAttendance.check_out_at,
        is_late: updatedAttendance.is_late,
        server_time: nowKST,
      },
      message: '관리 종료가 기록되었습니다.',
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 5. 주차 정보 (GET)-------------------------------------
exports.getSemesterMeta = async (req, res) => {
  try {
    const { data, count, error } = await supabase
      .from('Semester_Weeks')
      .select('week_number, start_date, end_date', { count: 'exact' })
      .order('week_number', { ascending: true });

    if (error) throw error;

    res.status(200).json({
      success: true,
      totalWeeks: count || 0,
      weeks: data || [],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
