const express = require('express');
const cors = require('cors');

const agendaController = require('./controllers/agendaController');
const suggestionController = require('./controllers/suggestionController');
const supplyController = require('./controllers/supplyController');
const adminController = require('./controllers/adminController');

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

app.get('/api/admins', adminController.getAllAdmins);          
app.post('/api/admins', adminController.createAdmin);         
app.delete('/api/admins/:id', adminController.deleteAdmin);  
app.get('/api/admins/ranking', adminController.getLateRanking); 
app.get('/api/admins/:id/logs', adminController.getAdminLogs);  

// app.post('/api/users', userController.createUser);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 가동 중입니다!`);
});