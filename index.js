const express = require('express');
const cors = require('cors');

const agendaController = require('./controllers/agendaController');
const suggestionController = require('./controllers/suggestionController');
const supplyController = require('./controllers/supplyController');
const userController = require('./controllers/userController');
const adminController = require('./controllers/adminController');
const labController = require('./controllers/labController');
const scheduleController = require('./controllers/scheduleController');

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());


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
app.get('/api/users/:id', userController.getAdminDetail);
app.patch('/api/users/:id', userController.updateAdminInfo);       
app.get('/api/users/ranking', userController.getLateRanking); 
app.get('/api/users/:id/logs', userController.getAdminLogs);  

app.get('/api/lab', labController.getLabComputers); 
app.get('/api/lab/broken', labController.getBrokenComputers);   
app.get('/api/lab/:id', labController.getComputerDetail);      
app.patch('/api/lab/:id', labController.updateComputerInfo);   
app.post('/api/lab/:id/reports', labController.createRepairRequest); 
app.delete('/api/lab/reports/:id', labController.deleteRepairRequest);


app.get('/api/schedules/today', scheduleController.getTodaySchedule);
app.patch('/api/schedules/change', scheduleController.requestSubstitute);
app.post('/api/attendance/:weekly_id/start', scheduleController.checkIn);
app.patch('/api/attendance/:attendance_id/end', scheduleController.checkOut);

//[관리자 전용]
app.post('/api/admin/schedules/init', adminController.resetSemester);      
app.post('/api/admin/setup-weeks', adminController.setupAcademicCalendar);  
app.patch('/api/admin/schedules/:weekly_id', adminController.updateWeeklySchedule); 
app.post('/api/admins/users', adminController.createAdmin);         
app.delete('/api/admins/users/:id', adminController.deleteAdmin); 


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});

app.get('/', (req, res) => {
  res.send('CSPC 관리 페이지 서버 일하는듕');
});