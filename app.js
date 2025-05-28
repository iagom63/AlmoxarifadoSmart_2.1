
const express = require('express');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const http = require('http');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect('mongodb+srv://iagom63im:YIznlIgbhqVfaBOC@almoxarifadosmart20.8ijh75f.mongodb.net/AlmoxarifadoSmart20?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const saidaSchema = new mongoose.Schema({
  nome: String,
  descricao: String,
  quantidade: String,
  unidade: String,
  tipo: String,
  data: String,
  observacao: String,
  responsavel: String,
  delivered: Boolean,
  visivel: { type: Boolean, default: true },
  timestamp: Number
});

const Saida = mongoose.model('Saida', saidaSchema);

const getCurrentDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

app.get('/api/saidas', async (req, res) => {
  const dados = await Saida.find({ visivel: { $ne: false } });
  res.json(dados);
});

app.post('/remover/:id', async (req, res) => {
  try {
    const item = await Saida.findById(req.params.id);
    if (item) {
      item.visivel = false;
      await item.save();
      io.emit('update');
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch {
    res.status(500).send('Erro ao processar remoção lógica');
  }
});

app.post('/reordenar/:id', async (req, res) => {
  try {
    const item = await Saida.findById(req.params.id);
    if (item) {
      item.delivered = !item.delivered;
      item.visivel = false;
      await item.save();
      io.emit('update');
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch {
    res.status(500).send('Erro ao processar devolução');
  }
});

app.get('/', (req, res) => {
  res.redirect('/solicitacao.html');
});

io.on('connection', (socket) => {
  console.log('Cliente conectado');
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

app.post('/itens', async (req, res) => {
  // lógica para inserir vários itens no banco
});
