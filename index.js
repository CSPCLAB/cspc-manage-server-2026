const express = require('express');
const cors = require('cors');

const agendaController = require('./controllers/agendaController');
const suggestionController = require('./controllers/suggestionController');
const supplyController = require('./controllers/supplyController');
const userController = require('./controllers/userController');
//const adminController = require('./controllers/adminController');

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// [지도 구역] 주소와 컨트롤러를 여기서 직접 연결합니다.
app.get('/api/agendas', agendaController.getAgendas); 
app.post('/api/agendas', agendaController.createAgenda);
app.delete('/api/agendas/:id', agendaController.deleteAgenda); 


app.get('/api/suggestions', suggestionController.getSuggestions);
app.post('/api/suggestions', suggestionController.createSuggestion);
app.delete('/api/suggestions/:id', suggestionController.deleteSuggestion);


app.get('/api/supplies', supplyController.getSupplies);
app.post('/api/supplies', supplyController.createSupply);
app.patch('/api/supplies/:id', supplyController.completeSupply);
app.delete('/api/supplies/:id', supplyController.deleteSupply);

app.get('/api/users', userController.getAllAdmins);          
app.get('/api/users/ranking', userController.getLateRanking); 
app.get('/api/users/:id/logs', userController.getAdminLogs);  

//[관리자 전용]
/*
app.post('/api/admin/schedules/init', adminController.resetSemester);      
app.post('/api/admin/setup-weeks', adminController.setupAcademicCalendar);  
app.patch('/api/admin/schedules/:weekly_id', adminController.updateWeeklySchedule); 
app.post('/api/admins', adminController.createAdmin);         
app.delete('/api/admins/:id', adminController.deleteAdmin); 
*/

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});