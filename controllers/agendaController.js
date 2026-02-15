const supabase = require('../config/supabaseClient');

// 1. 모든 안건 조회하기 (GET)-------------------------------------
exports.getAgendas = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('Meeting_Agendas')
      .select('*')
      .order('id', { ascending: false }); // id 기준 최신순 정렬

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: data,
      message: "안건 목록을 성공적으로 불러왔습니다."
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      data: null, 
      message: "서버 오류: " + err.message 
    });
  }
};

// 2. 회의 안건 저장하기 (POST)------------------------------------
exports.createAgenda = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        data: null,
        message: "전달된 회의 안건 내용이 없습니다." 
      });
    }

    const { data, error } = await supabase
      .from('Meeting_Agendas')
      .insert([{ content }])
      .select();

    if (error) throw error;

    res.status(201).json({ 
      success: true, 
      data: data[0], 
      message: "회의 안건이 등록되었습니다." 
    });

  } catch (err) {
    res.status(500).json({ 
      success: false, 
      data: null,
      message: "서버 오류: " + err.message 
    });
  }
};

// 3. 특정 안건 삭제하기 (DELETE)----------------------------------
exports.deleteAgenda = async (req, res) => {
  try {
    const { id } = req.params; // URL 주소에서 id를 받아오기 (api/agendas/10)

    const { error } = await supabase
      .from('Meeting_Agendas')
      .delete()
      .eq('id', id); // DB에서 id가 일치하는 행만 삭제

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: "회의 안건이 삭제되었습니다."
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      data: null, 
      message: "서버 오류: " + err.message 
    });
  }
};