create extension if not exists pg_cron;

create or replace function public.run_attendance_jobs()
returns void
language plpgsql
security definer
as $$
declare
  now_kst timestamp := now() at time zone 'Asia/Seoul';
begin
  with today_schedules as (
    select
      ws.id as weekly_schedule_id,
      ws.assigned_admin_id as admin_id,
      (
        (
          sw.start_date
          + case left(ts.day_of_week, 1)
              when '월' then 0
              when '화' then 1
              when '수' then 2
              when '목' then 3
              when '금' then 4
              when '토' then 5
              when '일' then 6
              else 0
            end
        )::timestamp
        + ts.start_time
      ) as class_start,
      (
        (
          sw.start_date
          + case left(ts.day_of_week, 1)
              when '월' then 0
              when '화' then 1
              when '수' then 2
              when '목' then 3
              when '금' then 4
              when '토' then 5
              when '일' then 6
              else 0
            end
        )::timestamp
        + ts.end_time
      ) as class_end
    from "Weekly_Schedules" ws
    join "Semester_Weeks" sw
      on sw.week_number = ws.week_number
    join "Timetable_Slots" ts
      on ts.id = ws.slot_id
    where sw.start_date <= now_kst::date
      and sw.end_date >= now_kst::date
  )
  insert into "Shift_Attendance" (
    weekly_schedule_id,
    admin_id,
    check_in_at,
    check_out_at,
    is_late
  )
  select
    ts.weekly_schedule_id,
    ts.admin_id,
    null,
    null,
    false
  from today_schedules ts
  where ts.admin_id is not null
    and now_kst >= ts.class_start - interval '1 minute'
    and now_kst <= ts.class_end + interval '10 minute'
    and not exists (
      select 1
      from "Shift_Attendance" sa
      where sa.weekly_schedule_id = ts.weekly_schedule_id
    );

  with today_schedules as (
    select
      ws.id as weekly_schedule_id,
      (
        (
          sw.start_date
          + case left(ts.day_of_week, 1)
              when '월' then 0
              when '화' then 1
              when '수' then 2
              when '목' then 3
              when '금' then 4
              when '토' then 5
              when '일' then 6
              else 0
            end
        )::timestamp
        + ts.start_time
      ) as class_start,
      (
        (
          sw.start_date
          + case left(ts.day_of_week, 1)
              when '월' then 0
              when '화' then 1
              when '수' then 2
              when '목' then 3
              when '금' then 4
              when '토' then 5
              when '일' then 6
              else 0
            end
        )::timestamp
        + ts.end_time
      ) as class_end
    from "Weekly_Schedules" ws
    join "Semester_Weeks" sw
      on sw.week_number = ws.week_number
    join "Timetable_Slots" ts
      on ts.id = ws.slot_id
    where sw.start_date <= now_kst::date
      and sw.end_date >= now_kst::date
  ),
  late_rows as (
    update "Shift_Attendance" sa
    set is_late = true
    from today_schedules ts
    where sa.weekly_schedule_id = ts.weekly_schedule_id
      and coalesce(sa.is_late, false) = false
      and (
        (sa.check_in_at is null and now_kst >= ts.class_start + interval '10 minute')
        or
        (sa.check_out_at is null and now_kst >= ts.class_end + interval '10 minute')
      )
    returning sa.admin_id
  ),
  late_counts as (
    select admin_id, count(*)::int as cnt
    from late_rows
    where admin_id is not null
    group by admin_id
  )
  update "Admin_Users" au
  set late_count = coalesce(au.late_count, 0) + lc.cnt
  from late_counts lc
  where au.id = lc.admin_id;
end;
$$;

-- Supabase SQL Editor에서 한 번 실행하세요.
-- 이미 같은 이름의 cron이 있으면 먼저 지운 뒤 다시 등록하면 됩니다.
-- select cron.unschedule('attendance-jobs-every-minute');
select cron.schedule(
  'attendance-jobs-every-minute',
  '* * * * *',
  $$select public.run_attendance_jobs();$$
);
