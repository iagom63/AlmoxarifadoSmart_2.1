// app.js
const express   = require('express');
const mongoose  = require('mongoose');
const socketIO  = require('socket.io');
const http      = require('http');
const path      = require('path');
const fs        = require('fs');
const ExcelJS   = require('exceljs');

const app    = express();
const server = http.createServer(app);
const io     = socketIO(server);
const PORT   = process.env.PORT || 3000;

// Servir arquivos estáticos da pasta public
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar ao MongoDB Atlas
mongoose.connect(
  'mongodb+srv://iagom63im:YIznlIgbhqVfaBOC@almoxarifadosmart20.8ijh75f.mongodb.net/almoxarifadosmart?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
);

// Definição do schema com remoção lógica
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

// Utilitário para data atual (YYYY-MM-DD)
const getCurrentDate = () => new Date().toISOString().split('T')[0];

// → GET /api/saidas
app.get('/api/saidas', async (req, res) => {
  const dados = await Saida.find({ visivel: { $ne: false } });
  res.json(dados);
});

// → POST /adicionar
app.post('/adicionar', async (req, res) => {
  const { nome, descricao, quantidade, unidade, tipo } = req.body;
  const data = getCurrentDate();
  const novoItem = new Saida({
    nome, descricao, quantidade, unidade, tipo,
    data, delivered: false, visivel: true, timestamp: Date.now()
  });
  await novoItem.save();
  io.emit('update');
  res.sendStatus(201);
});

// → POST /itens (com debug)
app.post('/itens', async (req, res) => {
  console.log('→ Recebido no /itens:', req.body);

  const { solicitante, destino, autorizado, count, ...rest } = req.body;
  const data      = getCurrentDate();
  const timestamp = Date.now();
  const registros = [];

  for (let i = 0; i < Number(count); i++) {
    const item = new Saida({
      nome: solicitante,
      observacao: destino,
      responsavel: autorizado,
      tipo: rest[`tipo_${i}`],
      descricao: rest[`descricao_${i}`],
      quantidade: rest[`quantidade_${i}`],
      unidade: rest[`unidade_${i}`],
      data,
      delivered: false,
      visivel: true,
      timestamp
    });
    registros.push(item);
  }

  await Saida.insertMany(registros);
  console.log('→ Itens gravados:', registros);

  io.emit('update');
  res.redirect('/solicitacao.html');
});

// → POST /editar/:id
app.post('/editar/:id', async (req, res) => {
  const { nome, descricao, quantidade, unidade, tipo, observacao } = req.body;
  try {
    const item = await Saida.findById(req.params.id);
    if (!item) return res.status(404).send('Item não encontrado');
    item.nome       = nome;
    item.descricao  = descricao;
    item.quantidade = quantidade;
    item.unidade    = unidade;
    item.tipo       = tipo;
    item.observacao = observacao + ' (editado em ' + new Date().toLocaleString() + ')';
    await item.save();
    io.emit('update');
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Erro ao editar item');
  }
});

// → GET /exportar-relatorio-excel
app.get('/exportar-relatorio-excel', async (req, res) => {
  const { inicio, fim } = req.query;
  if (!inicio || !fim) return res.status(400).send('Datas de início e fim são obrigatórias.');
  try {
    const dados = await Saida.find({ data: { $gte: inicio, $lte: fim } });
    if (!dados.length) return res.status(404).send('Nenhum item encontrado no intervalo informado.');
    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório');
    worksheet.columns = [
      { header: 'Nome',         key: 'nome',       width: 20 },
      { header: 'Descrição',    key: 'descricao',  width: 25 },
      { header: 'Quantidade',   key: 'quantidade', width: 10 },
      { header: 'Unidade',      key: 'unidade',    width: 10 },
      { header: 'Tipo',         key: 'tipo',       width: 15 },
      { header: 'Data',         key: 'data',       width: 15 },
      { header: 'Entregue?',    key: 'delivered',  width: 10 },
      { header: 'Observação',   key: 'observacao', width: 30 }
    ];
    dados.forEach(i =>
      worksheet.addRow({
        nome: i.nome,
        descricao: i.descricao,
        quantidade: i.quantidade,
        unidade: i.unidade,
        tipo: i.tipo,
        data: i.data,
        delivered: i.delivered ? 'Sim' : 'Não',
        observacao: i.observacao || ''
      })
    );
    const fileName = `relatorio_${inicio}_a_${fim}.xlsx`;
    const filePath = path.join(__dirname, fileName);
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, fileName, err => { if (!err) fs.unlinkSync(filePath); });
  } catch {
    res.status(500).send('Erro ao gerar relatório Excel.');
  }
});

// → GET /exportar-relatorio
app.get('/exportar-relatorio', async (req, res) => {
  const currentDate = getCurrentDate();
  const dados = await Saida.find({ data: currentDate });
  if (!dados.length) return res.status(404).send('Nenhum item encontrado para o dia atual');
  const workbook  = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Relatório do Dia');
  worksheet.columns = [
    { header: 'Nome',        key: 'nome',      width: 20 },
    { header: 'Descrição',   key: 'descricao', width: 25 },
    { header: 'Quantidade',  key: 'quantidade', width: 10 },
    { header: 'Unidade',     key: 'unidade',   width: 10 },
    { header: 'Tipo',        key: 'tipo',      width: 15 },
    { header: 'Data',        key: 'data',      width: 15 },
    { header: 'Entregue?',   key: 'delivered', width: 10 },
    { header: 'Observação',  key: 'observacao',width: 30 }
  ];
  dados.forEach(i =>
    worksheet.addRow({
      nome: i.nome,
      descricao: i.descricao,
      quantidade: i.quantidade,
      unidade: i.unidade,
      tipo: i.tipo,
      data: i.data,
      delivered: i.delivered ? 'Sim' : 'Não',
      observacao: i.observacao || ''
    })
  );
  const fileName = `relatorio_${currentDate}.xlsx`;
  const filePath = path.join(__dirname, fileName);
  await workbook.xlsx.writeFile(filePath);
  res.download(filePath, fileName, err => { if (!err) fs.unlinkSync(filePath); });
});

// → POST reordenar (marca devolução)
app.post('/reordenar/:id', async (req, res) => {
  try {
    const item = await Saida.findById(req.params.id);
    if (!item) return res.sendStatus(404);
    item.delivered = !item.delivered;
    await item.save();
    io.emit('update');
    res.sendStatus(200);
  } catch {
    res.status(500).send('Erro ao marcar devolução');
  }
});

// → POST remover (remoção lógica)
app.post('/remover/:id', async (req, res) => {
  try {
    const item = await Saida.findById(req.params.id);
    if (!item) return res.sendStatus(404);
    item.visivel = false;
    await item.save();
    io.emit('update');
    res.sendStatus(200);
  } catch {
    res.status(500).send('Erro ao processar remoção');
  }
});

app.get('/', (req, res) => res.redirect('/solicitacao.html'));

io.on('connection', socket => {
  console.log('Cliente conectado');
  socket.on('disconnect', () => console.log('Cliente desconectado'));
});

server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
