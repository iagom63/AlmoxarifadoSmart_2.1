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

// Servir arquivos estáticos da pasta public
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar ao MongoDB Atlas
mongoose.connect(
  'mongodb+srv://iagom63im:YIznlIgbhqVfaBOC@almoxarifadosmart20.8ijh75f.mongodb.net/almoxarifadosmart?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
);

// Definição do schema com o campo visivel para remoção lógica
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

// Função utilitária para data atual (YYYY-MM-DD)
const getCurrentDate = () => new Date().toISOString().split('T')[0];

// Rota para obter todas as saídas visíveis
app.get('/api/saidas', async (req, res) => {
  const dados = await Saida.find({ visivel: { $ne: false } });
  res.json(dados);
});

// Rota para adicionar um único item
app.post('/adicionar', async (req, res) => {
  const { nome, descricao, quantidade, unidade, tipo } = req.body;
  const data = getCurrentDate();
  const novoItem = new Saida({
    nome,
    descricao,
    quantidade,
    unidade,
    tipo,
    data,
    delivered: false,
    visivel: true,
    timestamp: Date.now()
  });
  await novoItem.save();
  io.emit('update');
  res.sendStatus(201);
});

// Rota para processar os itens vindos de itens.html
app.post('/itens', async (req, res) => {
  const { solicitante, destino, autorizado, count, ...rest } = req.body;
  const data = getCurrentDate();
  const timestamp = Date.now();
  const registros = [];

  for (let i = 0; i < Number(count); i++) {
    registros.push(
      new Saida({
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
      })
    );
  }

  await Saida.insertMany(registros);
  io.emit('update');
  // Redireciona de volta para a tela inicial ou onde preferir
  res.redirect('/solicitacao.html');
});

// Rota para edição de um item específico
app.post('/editar/:id', async (req, res) => {
  const { nome, descricao, quantidade, unidade, tipo, observacao } = req.body;
  try {
    const item = await Saida.findById(req.params.id);
    if (!item) return res.status(404).send('Item não encontrado');

    item.nome = nome;
    item.descricao = descricao;
    item.quantidade = quantidade;
    item.unidade = unidade;
    item.tipo = tipo;
    item.observacao = observacao + ' (editado em ' + new Date().toLocaleString() + ')';
    await item.save();

    io.emit('update');
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Erro ao editar item');
  }
});

// Rota para exportar relatório em Excel por intervalo de datas
app.get('/exportar-relatorio-excel', async (req, res) => {
  const { inicio, fim } = req.query;
  if (!inicio || !fim) return res.status(400).send('Datas de início e fim são obrigatórias.');

  try {
    const dados = await Saida.find({ data: { $gte: inicio, $lte: fim } });
    if (!dados.length) return res.status(404).send('Nenhum item encontrado no intervalo informado.');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório');
    worksheet.columns = [
      { header: 'Nome', key: 'nome', width: 20 },
      { header: 'Descrição', key: 'descricao', width: 25 },
      { header: 'Quantidade', key: 'quantidade', width: 10 },
      { header: 'Unidade', key: 'unidade', width: 10 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Data', key: 'data', width: 15 },
      { header: 'Entregue?', key: 'delivered', width: 10 },
      { header: 'Observação', key: 'observacao', width: 30 }
    ];
    dados.forEach(item => {
      worksheet.addRow({
        nome: item.nome,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        tipo: item.tipo,
        data: item.data,
        delivered: item.delivered ? 'Sim' : 'Não',
        observacao: item.observacao || ''
      });
    });

    const fileName = `relatorio_${inicio}_a_${fim}.xlsx`;
    const filePath = path.join(__dirname, fileName);
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, fileName, err => {
      if (!err) fs.unlinkSync(filePath);
    });
  } catch (err) {
    res.status(500).send('Erro ao gerar relatório Excel.');
  }
});

// Rota para exportar relatório do dia atual em Excel
app.get('/exportar-relatorio', async (req, res) => {
  const currentDate = getCurrentDate();
  const dados = await Saida.find({ data: currentDate });
  if (!dados.length) return res.status(404).send('Nenhum item encontrado para o dia atual');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Relatório do Dia');
  worksheet.columns = [
    { header: 'Nome', key: 'nome', width: 20 },
    { header: 'Descrição', key: 'descricao', width: 25 },
    { header: 'Quantidade', key: 'quantidade', width: 10 },
    { header: 'Unidade', key: 'unidade', width: 10 },
    { header: 'Tipo', key: 'tipo', width: 15 },
    { header: 'Data', key: 'data', width: 15 },
    { header: 'Entregue?', key: 'delivered', width: 10 },
    { header: 'Observação', key: 'observacao', width: 30 }
  ];
  dados.forEach(item => {
    worksheet.addRow({
      nome: item.nome,
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      tipo: item.tipo,
      data: item.data,
      delivered: item.delivered ? 'Sim' : 'Não',
      observacao: item.observacao || ''
    });
  });

  const fileName = `relatorio_${currentDate}.xlsx`;
  const filePath = path.join(__dirname, fileName);
  await workbook.xlsx.writeFile(filePath);
  res.download(filePath, fileName, err => {
    if (!err) fs.unlinkSync(filePath);
  });
});

// Rota para alternar 'delivered' (devolução) — não altera visivel
app.post('/reordenar/:id', async (req, res) => {
  try {
    const item = await Saida.findById(req.params.id);
    if (!item) return res.sendStatus(404);
    item.delivered = !item.delivered;
    await item.save();
    io.emit('update');
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao marcar devolução');
  }
});

// Rota para remoção lógica (visivel = false)
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

// Redireciona raiz para a tela de solicitação
app.get('/', (req, res) => res.redirect('/solicitacao.html'));

// WebSocket para atualizações em tempo real
io.on('connection', socket => {
  console.log('Cliente conectado');
  socket.on('disconnect', () => console.log('Cliente desconectado'));
});

// Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
