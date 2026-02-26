const supabase = require('../config/supabaseClient');

// 1. 특정 호수 전체 기기 조회 (GET)-----------------------------
exports.getLabComputers = async (req, res) => {
  try {
    const { location } = req.query;
    const { data, error } = await supabase
      .from('Lab_Computers')
      .select('*')
      .eq('location', location)
      .order('computer_number', { ascending: true }); // 번호순 정렬

    if (error) throw error;
    res.status(200).json({ success: true, data, message: "특정 호수 전체 기기 정보를 불러왔습니다."});
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 2. 특정 컴퓨터 상세 정보 + 고장 요청 목록 조회 (GET)--------------
exports.getComputerDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('Lab_Computers')
      .select(`
        *,
        reports:Repair_Requests(*)
      `) // Join 쿼리로 한 번에 가져옴
      .eq('id', id)
      .single();

    if (error) throw error;
    res.status(200).json({ success: true, data, message: "특정 컴퓨터 상세 정보와 고장 요청 목록을 불러왔습니다. " });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 3. 특정 컴퓨터 정보 수정 (PATCH)--------------------------------
exports.updateComputerInfo = async (req, res) => {
  try {
    const { id } = req.params;
    // 수정 가능한 필드들만 body에서 가져옴
    const { location, computer_number, is_broken, manufacturer, model, serial_number } = req.body;

    const { data, error } = await supabase
      .from('Lab_Computers')
      .update({ 
        location, 
        computer_number, 
        is_broken,
        manufacturer, 
        model, 
        serial_number 
      })
      .eq('id', id)
      .select(); // 수정된 결과를 다시 받아옴

    if (error) {
      // 만약 수정하려는 위치/번호가 이미 존재한다면 UNIQUE 제약 조건 때문에 에러가 발생
      if (error.code === '23505') { //고유 제약조건 위반(PostgreSQL)
        return res.status(409).json({ 
          success: false, 
          data: null,
          message: "이미 해당 위치에 동일한 컴퓨터 번호가 존재합니다." 
        });
      }
      throw error;
    }

    res.status(200).json({ 
      success: true, 
      data: data[0], 
      message: "기기 정보가 성공적으로 수정되었습니다." 
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 3. 고장 요청 작성 (POST)---------------------------------------
exports.createRepairRequest = async (req, res) => {
  try {
    const { id } = req.params; // computer_id
    const { category, title } = req.body;

    //고장 요청 추가
    const { error: reportError } = await supabase
      .from('Repair_Requests')
      .insert([{ computer_id: id, category, title }]);

    if (reportError) throw reportError;

    //해당 컴퓨터 상태를 true로 변경
    const { error: updateError } = await supabase
      .from('Lab_Computers')
      .update({ is_broken: true })
      .eq('id', id);

    if (updateError) throw updateError;

    res.status(201).json({ success: true, data, message: "고장 신고가 접수되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 4. 고장 요청 삭제 (DELETE)--------------------------------------
exports.deleteRepairRequest = async (req, res) => {
  try {
    const { id } = req.params; // report_id

    //삭제할 요청의 computer_id를 가져옴
    const { data: reportData } = await supabase
      .from('Repair_Requests')
      .select('computer_id')
      .eq('id', id)
      .single();

    const computerId = reportData.computer_id;

    //요청 삭제
    const { error: deleteError } = await supabase
      .from('Repair_Requests')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    //남은 고장 요청이 있는지 확인
    const { count } = await supabase
      .from('Repair_Requests')
      .select('*', { count: 'exact', head: true })
      .eq('computer_id', computerId);

    //남은 요청이 0개라면 상태를 false으로 변경
    if (count === 0) {
      await supabase
        .from('Lab_Computers')
        .update({ is_broken: false })
        .eq('id', computerId);
    }

    res.status(200).json({ success: true, message: "요청이 삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};

// 5. 고장난 기기 전체 조회 (GET)----------------------------------
exports.getBrokenComputers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('Lab_Computers')
      .select(`
        *,
        reports:Repair_Requests(*)
      `)
      .eq('is_broken', true); // 고장난 것만 필터링

    if (error) throw error;
    res.status(200).json({ success: true, data, message: "고장난 기기 목록을 불러왔습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: err.message });
  }
};