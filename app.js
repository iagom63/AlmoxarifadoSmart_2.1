
const express = require('express');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar ao MongoDB Atlas
mongoose.connect('mongodb+srv://iagom63im:<db_password>@almoxarifadosmart20.8ijh75f.mongodb.net/almoxarifadosmart?retryWrites=true&w=majority&appName=AlmoxarifadoSmart20', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Definir schema
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
  timestamp: Number
});

// Modelo
const Saida = mongoose.model('Saida', saidaSchema);

// Obter data atual
const getCurrentDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

// Rotas
app.get('/api/saidas', async (req, res) => {
  const dados = await Saida.find();
  res.json(dados);
});

app.post('/remover/:id', async (req, res) => {
  try {
    await Saida.findByIdAndDelete(req.params.id);
    io.emit('update');
    res.sendStatus(200);
  } catch {
    res.sendStatus(404);
  }
});

app.post('/reordenar/:id', async (req, res) => {
  try {
    const item = await Saida.findById(req.params.id);
    item.delivered = !item.delivered;
    await item.save();
    io.emit('update');
    res.sendStatus(200);
  } catch {
    res.sendStatus(404);
  }
});

app.get('/exportar-relatorio', async (req, res) => {
  const currentDate = getCurrentDate();
  const dados = await Saida.find({ data: currentDate });

  if (!dados.length) return res.status(404).send('Nenhum item encontrado para o dia atual');

  res.json(dados);
});

app.get('/exportar-relatorio-completo', async (req, res) => {
  const dados = await Saida.find();
  if (!dados.length) return res.status(404).send('Nenhum item encontrado');
  res.json(dados);
});

app.post('/adicionar', async (req, res) => {
  const { nome, descricao, quantidade, unidade, tipo } = req.body;
  const data = getCurrentDate();
  const novoItem = new Saida({ nome, descricao, quantidade, unidade, tipo, data, delivered: false, timestamp: Date.now() });
  await novoItem.save();
  io.emit('update');
  res.sendStatus(201);
});

app.post('/itens', async (req, res) => {
  const { solicitante, destino, autorizado, count, ...rest } = req.body;
  const data = getCurrentDate();
  const timestamp = Date.now();

  const registros = [];

  for (let i = 0; i < Number(count); i++) {
    registros.push(new Saida({
      nome: solicitante,
      observacao: destino,
      responsavel: autorizado,
      tipo: rest[`tipo_${i}`],
      descricao: rest[`descricao_${i}`],
      quantidade: rest[`quantidade_${i}`],
      unidade: rest[`unidade_${i}`],
      data,
      delivered: false,
      timestamp
    }));
  }

  await Saida.insertMany(registros);
  io.emit('update');
  res.redirect('/solicitacao.html');
});

app.get('/', (req, res) => {
  res.redirect('/solicitacao.html');
});

// WebSocket
io.on('connection', (socket) => {
  console.log('Novo cliente conectado');
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
