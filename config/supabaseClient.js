const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // .env 파일의 변수들을 읽어오기

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Supabase 클라이언트 생성
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;