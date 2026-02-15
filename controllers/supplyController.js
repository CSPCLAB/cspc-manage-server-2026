const supabase = require('../config/supabaseClient');

// 1. 비품 요청 전체 목록 조회 (GET)------------------------------
exports.getSupplies = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('Supply_Requests') // DB 테이블명 확인
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: data,
      message: "비품 요청 목록을 불러왔습니다."
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      data: null,
      message: "서버 오류: " + err.message });
  }
};

// 2. 새로운 비품 요청 추가 (POST)--------------------------------
exports.createSupply = async (req, res) => {
  try {
    const { item_name } = req.body;

    if (!item_name || item_name.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        data: null, 
        message: "비품 이름을 입력해주세요." 
      });
    }

    const { data, error } = await supabase
      .from('Supply_Requests')
      .insert([{ item_name, is_completed: false }]) // 초기값은 false
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data: data[0], message: "비품 요청이 등록되었습니다." });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      data: null,
      message: "서버 오류: " + err.message });
  }
};

// 3. 비품 구매 완료/취소 처리 (PATCH)-----------------------------
exports.completeSupply = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_completed } = req.body; // 프론트에서 t/f 보냄

    const { data, error } = await supabase
      .from('Supply_Requests')
      .update({ is_completed }) // 상태 업데이트
      .eq('id', id)
      .select();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: data[0],
      message: is_completed ? "구매 완료 처리되었습니다." : "구매 취소 처리되었습니다."
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: "서버 오류: " + err.message });
  }
};

// 4. 요청 삭제 (DELETE)----------------------------------------
exports.deleteSupply = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('Supply_Requests')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ success: true, message: "비품 요청이 삭제되었습니다." });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: "서버 오류: " + err.message });
  }
};